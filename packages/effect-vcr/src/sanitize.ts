import { Effect, Option, Record } from "effect";
import { UrlParams } from "effect/unstable/http";
import stableStringify from "json-stable-stringify";

import type { VcrRedactedValue, VcrRequest, VcrResponse } from "./types";

/**
 * Normalize header names to match HttpClient's lowercase behavior.
 */
const normalizeHeaderKey = (key: string) => key.toLowerCase();

/**
 * Canonicalize headers: lowercase keys and stable ordering.
 */
const toHeaderRecord = (headers?: Record<string, string>) => {
  if (!headers) return undefined;
  const lowered = Record.mapKeys(headers, normalizeHeaderKey);
  return Record.fromEntries(Record.toEntries(lowered).sort(([a], [b]) => a.localeCompare(b)));
};

/**
 * Remove specified header names (case-insensitive).
 */
const omitHeaderKeys = (
  headers: Record<string, string> | undefined,
  ignore: ReadonlyArray<string> | undefined,
): Option.Option<Record<string, string>> => {
  if (!headers) return Option.none();
  if (!ignore || ignore.length === 0) return Option.some(headers);
  const ignoreSet = new Set(ignore.map(normalizeHeaderKey));
  return Option.some(Record.filter(headers, (_, key) => !ignoreSet.has(normalizeHeaderKey(key))));
};

/**
 * Best-effort JSON parse; returns undefined for non-JSON bodies.
 */
const tryParseJson = Option.liftThrowable((input: string) => JSON.parse(input));

type BodyOptions = {
  readonly omit?: ReadonlyArray<string>;
  readonly replacements?: Readonly<Record<string, VcrRedactedValue>>;
};

type BodyTransformation<A> = {
  readonly value: A;
  readonly redacted: boolean;
};

/**
 * Recursively remove or replace keys in JSON values.
 */
const transformJsonKeys = (
  value: unknown,
  omit: ReadonlySet<string>,
  replacements: Readonly<Record<string, VcrRedactedValue>>,
): BodyTransformation<unknown> => {
  if (Array.isArray(value)) {
    let redacted = false;
    const values = value.map((item) => {
      const transformed = transformJsonKeys(item, omit, replacements);
      redacted ||= transformed.redacted;
      return transformed.value;
    });
    return { value: values, redacted };
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const next: Record<string, unknown> = {};
    let redacted = false;
    for (const [key, entry] of Object.entries(record)) {
      if (omit.has(key)) {
        redacted = true;
        continue;
      }
      if (Record.has(replacements, key)) {
        next[key] = replacements[key];
        redacted = true;
        continue;
      }
      const transformed = transformJsonKeys(entry, omit, replacements);
      next[key] = transformed.value;
      redacted ||= transformed.redacted;
    }
    return { value: next, redacted };
  }
  return { value, redacted: false };
};

const headerValue = (
  headers: Readonly<Record<string, string>> | undefined,
  name: string,
): string | undefined => {
  if (!headers) return undefined;
  const normalizedName = normalizeHeaderKey(name);
  return Object.entries(headers).find(([key]) => normalizeHeaderKey(key) === normalizedName)?.[1];
};

const isUrlEncoded = (headers: Readonly<Record<string, string>> | undefined): boolean =>
  headerValue(headers, "content-type")?.split(";", 1)[0]?.trim().toLowerCase() ===
  "application/x-www-form-urlencoded";

const transformUrlParams = (
  body: string,
  omit: ReadonlySet<string>,
  replacements: Readonly<Record<string, VcrRedactedValue>>,
): BodyTransformation<string> => {
  let redacted = false;
  const value = UrlParams.fromInput(new URLSearchParams(body)).pipe(
    UrlParams.transform((params) =>
      params.flatMap(([key, value]) => {
        if (omit.has(key)) {
          redacted = true;
          return [];
        }
        if (Record.has(replacements, key)) {
          redacted = true;
          return [[key, String(replacements[key])] as const];
        }
        return [[key, value] as const];
      }),
    ),
    UrlParams.toString,
  );
  return { value, redacted };
};

/**
 * Remove or replace JSON and URL-encoded body fields when possible.
 */
const transformBody = (
  body: string | undefined,
  headers: Readonly<Record<string, string>> | undefined,
  options: BodyOptions,
): Option.Option<BodyTransformation<string>> => {
  if (!body) return Option.none();
  const omit = new Set(options.omit);
  const replacements = options.replacements ?? {};
  if (isUrlEncoded(headers)) {
    const hasMatch = Array.from(new URLSearchParams(body).keys()).some(
      (key) => omit.has(key) || Record.has(replacements, key),
    );
    if (!hasMatch) {
      return Option.some({ value: body, redacted: false });
    }
    return Option.some(transformUrlParams(body, omit, replacements));
  }
  return Option.some(
    tryParseJson(body).pipe(
      Option.match({
        onNone: () => ({ value: body, redacted: false }),
        onSome: (parsed) => {
          const transformed = transformJsonKeys(parsed, omit, replacements);
          return {
            // stableStringify's return type is `string | undefined` for cyclic input;
            // parsed JSON is never cyclic, but the fallback keeps the types honest.
            value: stableStringify(transformed.value) ?? body,
            redacted: transformed.redacted,
          };
        },
      }),
    ),
  );
};

/**
 * Normalize request for matching: header canonicalization and structured body filtering.
 */
export const sanitizeRequest = (
  request: VcrRequest,
  options: {
    readonly ignoreHeaders?: ReadonlyArray<string>;
    readonly ignoreBodyKeys?: ReadonlyArray<string>;
  },
): VcrRequest => {
  const transformedBody = transformBody(request.body, request.headers, {
    omit: options.ignoreBodyKeys,
  });
  const body = Option.getOrUndefined(
    transformedBody.pipe(Option.map((transformed) => transformed.value)),
  );
  const filteredHeaders = omitHeaderKeys(
    request.headers,
    transformedBody.pipe(Option.exists((transformed) => transformed.redacted))
      ? [...(options.ignoreHeaders ?? []), "content-length"]
      : options.ignoreHeaders,
  );
  return {
    ...request,
    headers: toHeaderRecord(Option.getOrUndefined(filteredHeaders)),
    body,
  };
};

/**
 * Compute the stable request key used for cassette lookups.
 */
export const buildRequestKey = (
  request: VcrRequest,
  options: {
    readonly ignoreHeaders?: ReadonlyArray<string>;
    readonly ignoreBodyKeys?: ReadonlyArray<string>;
  },
): Effect.Effect<string> =>
  Effect.sync(() => {
    const sanitized = sanitizeRequest(request, {
      ignoreHeaders: options.ignoreHeaders,
      ignoreBodyKeys: options.ignoreBodyKeys,
    });
    // stableStringify only returns undefined for cyclic input; this literal never is,
    // but its declared type is `string | undefined`, so keep the fallback for TS.
    return (
      stableStringify({
        method: sanitized.method.toUpperCase(),
        url: sanitized.url,
        headers: sanitized.headers ?? {},
        body: sanitized.body ?? "",
      }) ??
      JSON.stringify({
        method: sanitized.method.toUpperCase(),
        url: sanitized.url,
        headers: sanitized.headers ?? {},
        body: sanitized.body ?? "",
      })
    );
  });

/**
 * Remove sensitive request data before persisting to a cassette.
 */
export const redactRequest = (
  request: VcrRequest,
  options: {
    readonly redactHeaders?: ReadonlyArray<string>;
    readonly redactBodyKeys?: ReadonlyArray<string>;
    readonly bodyReplacements?: Readonly<Record<string, VcrRedactedValue>>;
  },
): VcrRequest => {
  const transformedBody = transformBody(request.body, request.headers, {
    omit: options.redactBodyKeys,
    replacements: options.bodyReplacements,
  });
  const body = Option.getOrUndefined(
    transformedBody.pipe(Option.map((transformed) => transformed.value)),
  );
  return {
    ...request,
    headers: Option.getOrUndefined(
      omitHeaderKeys(
        request.headers,
        transformedBody.pipe(Option.exists((transformed) => transformed.redacted))
          ? [...(options.redactHeaders ?? []), "content-length"]
          : options.redactHeaders,
      ),
    ),
    body,
  };
};

/**
 * Remove sensitive response data before persisting to a cassette.
 */
export const redactResponse = (
  response: VcrResponse,
  options: {
    readonly redactHeaders?: ReadonlyArray<string>;
    readonly redactBodyKeys?: ReadonlyArray<string>;
    readonly bodyReplacements?: Readonly<Record<string, VcrRedactedValue>>;
  },
): VcrResponse => {
  const transformedBody = transformBody(response.body, response.headers, {
    omit: options.redactBodyKeys,
    replacements: options.bodyReplacements,
  });
  const body = Option.getOrElse(
    transformedBody.pipe(Option.map((transformed) => transformed.value)),
    () => response.body,
  );
  return {
    ...response,
    headers: Option.getOrUndefined(
      omitHeaderKeys(
        response.headers,
        transformedBody.pipe(Option.exists((transformed) => transformed.redacted))
          ? [...(options.redactHeaders ?? []), "content-length"]
          : options.redactHeaders,
      ),
    ),
    body,
  };
};
