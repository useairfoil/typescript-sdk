import { Effect, Option } from "effect";
import stableStringify from "json-stable-stringify";

import type { VcrRequest, VcrResponse } from "./types";

/**
 * Normalize header names to match HttpClient's lowercase behavior.
 */
const normalizeHeaderKey = (key: string) => key.toLowerCase();

/**
 * Canonicalize headers: lowercase keys and stable ordering.
 */
const toHeaderRecord = (headers?: Record<string, string>) => {
  if (!headers) return undefined;
  const entries = Object.entries(headers).map(
    ([key, value]) => [normalizeHeaderKey(key), value] as const,
  );
  entries.sort(([a], [b]) => a.localeCompare(b));
  const record: Record<string, string> = {};
  for (const [key, value] of entries) {
    record[key] = value;
  }
  return record;
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
  const filtered: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (!ignoreSet.has(normalizeHeaderKey(key))) {
      filtered[key] = value;
    }
  }
  return Option.some(filtered);
};

/**
 * Best-effort JSON parse; returns undefined for non-JSON bodies.
 */
const tryParseJson = Option.liftThrowable((input: string) => JSON.parse(input));

/**
 * Recursively drop keys from JSON objects to build stable request keys.
 */
const stripKeys = (value: unknown, ignore: Set<string>): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => stripKeys(item, ignore));
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const next: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(record)) {
      if (!ignore.has(key)) {
        next[key] = stripKeys(entry, ignore);
      }
    }
    return next;
  }
  return value;
};

/**
 * Remove JSON keys from a string body when possible.
 */
const omitBodyKeys = (
  body: string | undefined,
  ignore: ReadonlyArray<string> | undefined,
): Option.Option<string> => {
  if (!body) return Option.none();
  return Option.some(
    tryParseJson(body).pipe(
      Option.match({
        onNone: () => body,
        onSome: (parsed) => {
          if (!ignore || ignore.length === 0) {
            return stableStringify(parsed) ?? body;
          }
          const ignoreSet = new Set(ignore);
          return stableStringify(stripKeys(parsed, ignoreSet)) ?? body;
        },
      }),
    ),
  );
};

/**
 * Normalize request for matching: header canonicalization + JSON body filtering.
 */
export const sanitizeRequest = (
  request: VcrRequest,
  options: {
    readonly ignoreHeaders?: ReadonlyArray<string>;
    readonly ignoreBodyKeys?: ReadonlyArray<string>;
  },
): VcrRequest => {
  const filteredHeaders = omitHeaderKeys(request.headers, options.ignoreHeaders);
  return {
    ...request,
    headers: toHeaderRecord(Option.getOrUndefined(filteredHeaders)),
    body: Option.getOrUndefined(omitBodyKeys(request.body, options.ignoreBodyKeys)),
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
  },
): VcrRequest => ({
  ...request,
  headers: Option.getOrUndefined(omitHeaderKeys(request.headers, options.redactHeaders)),
  body: Option.getOrUndefined(omitBodyKeys(request.body, options.redactBodyKeys)),
});

/**
 * Remove sensitive response data before persisting to a cassette.
 */
export const redactResponse = (
  response: VcrResponse,
  options: {
    readonly redactHeaders?: ReadonlyArray<string>;
    readonly redactBodyKeys?: ReadonlyArray<string>;
  },
): VcrResponse => ({
  ...response,
  headers: Option.getOrUndefined(omitHeaderKeys(response.headers, options.redactHeaders)),
  body: Option.getOrElse(omitBodyKeys(response.body, options.redactBodyKeys), () => response.body),
});
