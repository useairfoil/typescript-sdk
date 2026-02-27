import {
  HttpClient,
  HttpClientError,
  type HttpClientRequest,
  HttpClientResponse,
} from "@effect/platform";
import { Config, Effect } from "effect";
import { CassetteStore, type CassetteStoreService } from "./cassette-store";
import { buildRequestKey, redactRequest, redactResponse } from "./sanitize";
import type { VcrCassette, VcrConfig, VcrRequest, VcrResponse } from "./types";

/**
 * Decoder for Uint8Array request bodies when building cassette keys.
 */
const decoder = new TextDecoder();

/**
 * Build the cassette file path from dir + name.
 */
const cassettePath = (cassetteDir: string, cassetteName: string) => {
  const separator = cassetteDir.includes("\\") ? "\\" : "/";
  const trimmed =
    cassetteDir.endsWith("/") || cassetteDir.endsWith("\\")
      ? cassetteDir.slice(0, -1)
      : cassetteDir;
  return `${trimmed}${separator}${cassetteName}.json`;
};

/**
 * Convert store or replay failures into HttpClient transport errors.
 */
const toRequestError = (
  request: HttpClientRequest.HttpClientRequest,
  cause: unknown,
  description?: string,
) =>
  new HttpClientError.RequestError({
    request,
    reason: "Transport",
    cause,
    description,
  });

/**
 * Convert header map to a plain record for JSON persistence.
 */
const recordFromHeaders = (headers: Record<string, string>) => {
  const record: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    record[key] = value;
  }
  return record;
};

/**
 * Serialize an Effect HttpClientRequest into a cassette request shape.
 *
 * Note: some body variants (Stream, FormData) are not safely serializable
 * without consuming the body, so we store placeholders to avoid breaking
 * live requests.
 */
const toVcrRequest = (
  request: HttpClientRequest.HttpClientRequest,
): VcrRequest => {
  const headers = recordFromHeaders(request.headers as Record<string, string>);
  const body = (() => {
    switch (request.body._tag) {
      case "Empty":
        return "";
      case "Uint8Array":
        return decoder.decode(request.body.body);
      case "Raw": {
        const raw = request.body.body as unknown;
        if (typeof raw === "string") return raw;
        if (raw instanceof Uint8Array) return decoder.decode(raw);
        try {
          return JSON.stringify(raw);
        } catch {
          return "[raw]";
        }
      }
      case "FormData":
        return "[form-data]";
      case "Stream":
        return "[stream]";
    }
  })();

  return {
    method: request.method,
    url: request.url,
    headers,
    body,
  };
};

/**
 * Serialize an Effect HttpClientResponse into a cassette response shape.
 */
const toVcrResponse = (
  response: HttpClientResponse.HttpClientResponse,
  body: string,
): VcrResponse => ({
  status: response.status,
  body,
  headers: recordFromHeaders(response.headers as Record<string, string>),
});

/**
 * Load a cassette and map store errors into HttpClient errors.
 */
const readCassette = (
  path: string,
  store: CassetteStoreService,
  request: HttpClientRequest.HttpClientRequest,
): Effect.Effect<VcrCassette, HttpClientError.HttpClientError> =>
  store
    .load(path)
    .pipe(Effect.mapError((error) => toRequestError(request, error)));

/**
 * Load a cassette or initialize a new one if missing.
 */
const loadOrInitCassette = (
  path: string,
  store: CassetteStoreService,
  request: HttpClientRequest.HttpClientRequest,
): Effect.Effect<VcrCassette, HttpClientError.HttpClientError> =>
  store
    .loadOrInit(path)
    .pipe(Effect.mapError((error) => toRequestError(request, error)));

/**
 * Persist the updated cassette.
 */
const saveCassette = (
  path: string,
  store: CassetteStoreService,
  cassette: VcrCassette,
  request: HttpClientRequest.HttpClientRequest,
): Effect.Effect<void, HttpClientError.HttpClientError> =>
  store
    .save(path, cassette)
    .pipe(Effect.mapError((error) => toRequestError(request, error)));

/**
 * Locate a cassette entry by custom matcher or stable request key.
 */
const findEntry = (
  request: VcrRequest,
  cassette: VcrCassette,
  config: VcrConfig,
) => {
  if (config.match) {
    return Object.values(cassette.entries).find((entry) =>
      config.match?.(request, entry),
    );
  }
  const key = buildRequestKey(request, {
    ignoreHeaders: config.matchIgnore?.requestHeaders,
    ignoreBodyKeys: config.matchIgnore?.requestBodyKeys,
  });
  return cassette.entries[key];
};

/**
 * Replay a response from cassette data using HttpClientResponse.fromWeb.
 */
const replay = (
  request: HttpClientRequest.HttpClientRequest,
  vcrRequest: VcrRequest,
  config: VcrConfig,
  store: CassetteStoreService,
  path: string,
): Effect.Effect<
  HttpClientResponse.HttpClientResponse,
  HttpClientError.HttpClientError
> =>
  readCassette(path, store, request).pipe(
    Effect.flatMap((cassette) => {
      const entry = findEntry(vcrRequest, cassette, config);
      if (!entry) {
        return Effect.fail(
          new HttpClientError.RequestError({
            request,
            reason: "Transport",
            description: `VCR replay missing entry for ${request.method} ${request.url}`,
          }),
        );
      }
      const web = new Response(entry.response.body, {
        status: entry.response.status,
        headers: entry.response.headers,
      });
      return Effect.succeed(HttpClientResponse.fromWeb(request, web));
    }),
  );

/**
 * Record a live response into the cassette and return the original response.
 */
const record = (
  request: HttpClientRequest.HttpClientRequest,
  vcrRequest: VcrRequest,
  effect: Effect.Effect<
    HttpClientResponse.HttpClientResponse,
    HttpClientError.HttpClientError
  >,
  config: VcrConfig,
  store: CassetteStoreService,
  path: string,
): Effect.Effect<
  HttpClientResponse.HttpClientResponse,
  HttpClientError.HttpClientError
> =>
  Effect.gen(function* () {
    // Execute the live request and capture the response body (Effect caches reads).
    const response = yield* effect;
    const body = yield* response.text;
    const vcrResponse = toVcrResponse(response, body);

    const sanitizedRequest = config.redact
      ? redactRequest(vcrRequest, {
          redactHeaders: config.redact.requestHeaders,
          redactBodyKeys: config.redact.requestBodyKeys,
        })
      : vcrRequest;
    const sanitizedResponse = config.redact
      ? redactResponse(vcrResponse, {
          redactHeaders: config.redact.responseHeaders,
          redactBodyKeys: config.redact.responseBodyKeys,
        })
      : vcrResponse;

    // Load or create the cassette before inserting the new entry.
    const cassette = yield* loadOrInitCassette(path, store, request);
    const key = buildRequestKey(vcrRequest, {
      ignoreHeaders: config.matchIgnore?.requestHeaders,
      ignoreBodyKeys: config.matchIgnore?.requestBodyKeys,
    });
    const next: VcrCassette = {
      ...cassette,
      entries: {
        ...cassette.entries,
        [key]: {
          request: sanitizedRequest,
          response: sanitizedResponse,
        },
      },
    };
    // Persist updated cassette to disk.
    yield* saveCassette(path, store, next, request);
    return response;
  });

/**
 * Create a VCR-wrapped HttpClient by decorating the live client.
 */
export const makeVcrHttpClient = (
  live: HttpClient.HttpClient,
  config: VcrConfig,
) =>
  Effect.gen(function* () {
    // CassetteStore is provided via Layer for platform-specific persistence.
    const store = yield* CassetteStore;
    const path = cassettePath(config.cassetteDir, config.cassetteName);
    const isCi = yield* Config.boolean("CI").pipe(Config.withDefault(false));

    const client = live.pipe(
      HttpClient.transform((effect, request) => {
        const vcrRequest = toVcrRequest(request);
        if (config.mode === "replay") {
          return replay(request, vcrRequest, config, store, path);
        }

        if (config.mode === "record") {
          return record(request, vcrRequest, effect, config, store, path);
        }

        // Auto mode: replay if cassette exists, otherwise record (or fail in CI).
        return store.exists(path).pipe(
          Effect.mapError((error) => toRequestError(request, error)),
          Effect.flatMap((available) => {
            if (!available) {
              if (isCi) {
                return Effect.fail(
                  new HttpClientError.RequestError({
                    request,
                    reason: "Transport",
                    description: "VCR cassette missing in CI for auto mode",
                  }),
                );
              }
              return record(request, vcrRequest, effect, config, store, path);
            }

            return readCassette(path, store, request).pipe(
              Effect.flatMap((cassette) => {
                const entry = findEntry(vcrRequest, cassette, config);
                if (entry) {
                  const web = new Response(entry.response.body, {
                    status: entry.response.status,
                    headers: entry.response.headers,
                  });
                  return Effect.succeed(
                    HttpClientResponse.fromWeb(request, web),
                  );
                }
                return record(request, vcrRequest, effect, config, store, path);
              }),
            );
          }),
        );
      }),
    );

    return client;
  });

export const layer = (config: VcrConfig) =>
  HttpClient.layerMergedContext(
    Effect.gen(function* () {
      const live = yield* HttpClient.HttpClient;
      return yield* makeVcrHttpClient(live, config);
    }),
  );
