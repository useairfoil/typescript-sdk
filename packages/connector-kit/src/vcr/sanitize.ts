import stableStringify from "json-stable-stringify";
import type { VcrRequest, VcrResponse } from "./types";

const normalizeHeaderKey = (key: string) => key.toLowerCase();

// stable header record to avoid order diffs
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

// remove headers by name (case-insensitive)
const omitHeaderKeys = (
  headers: Record<string, string> | undefined,
  ignore: ReadonlyArray<string> | undefined,
) => {
  if (!headers) return undefined;
  if (!ignore || ignore.length === 0) return headers;
  const ignoreSet = new Set(ignore.map(normalizeHeaderKey));
  const filtered: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (!ignoreSet.has(normalizeHeaderKey(key))) {
      filtered[key] = value;
    }
  }
  return filtered;
};

const tryParseJson = (input: string) => {
  try {
    return JSON.parse(input) as unknown;
  } catch {
    return undefined;
  }
};

// deep remove keys from json structure
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

// remove keys from json string body if possible
const omitBodyKeys = (
  body: string | undefined,
  ignore: ReadonlyArray<string> | undefined,
) => {
  if (!body) return body;
  const parsed = tryParseJson(body);
  if (parsed === undefined) return body;
  if (!ignore || ignore.length === 0) return stableStringify(parsed);
  const ignoreSet = new Set(ignore);
  return stableStringify(stripKeys(parsed, ignoreSet));
};

// sanitize for matching (ignore keys but keep shape)
export const sanitizeRequest = (
  request: VcrRequest,
  options: {
    readonly ignoreHeaders?: ReadonlyArray<string>;
    readonly ignoreBodyKeys?: ReadonlyArray<string>;
  },
): VcrRequest => {
  const filteredHeaders = omitHeaderKeys(
    request.headers,
    options.ignoreHeaders,
  );
  return {
    ...request,
    headers: toHeaderRecord(filteredHeaders),
    body: omitBodyKeys(request.body, options.ignoreBodyKeys),
  };
};

// build a stable key for matching and storage
export const buildRequestKey = (
  request: VcrRequest,
  options: {
    readonly ignoreHeaders?: ReadonlyArray<string>;
    readonly ignoreBodyKeys?: ReadonlyArray<string>;
  },
) => {
  const sanitized = sanitizeRequest(request, {
    ignoreHeaders: options.ignoreHeaders,
    ignoreBodyKeys: options.ignoreBodyKeys,
  });
  return stableStringify({
    method: sanitized.method.toUpperCase(),
    url: sanitized.url,
    headers: sanitized.headers ?? {},
    body: sanitized.body ?? "",
  }) as string;
};

// redact before writing to cassette
export const redactRequest = (
  request: VcrRequest,
  options: {
    readonly redactHeaders?: ReadonlyArray<string>;
    readonly redactBodyKeys?: ReadonlyArray<string>;
  },
): VcrRequest => ({
  ...request,
  headers: omitHeaderKeys(request.headers, options.redactHeaders),
  body: omitBodyKeys(request.body, options.redactBodyKeys),
});

// redact before writing to cassette
export const redactResponse = (
  response: VcrResponse,
  options: {
    readonly redactHeaders?: ReadonlyArray<string>;
    readonly redactBodyKeys?: ReadonlyArray<string>;
  },
): VcrResponse => ({
  ...response,
  headers: omitHeaderKeys(response.headers, options.redactHeaders),
  body: omitBodyKeys(response.body, options.redactBodyKeys) ?? response.body,
});
