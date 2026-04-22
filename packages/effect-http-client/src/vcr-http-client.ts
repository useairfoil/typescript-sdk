import { Config, Effect, Option } from "effect";
import {
  HttpClient,
  HttpClientError,
  type HttpClientRequest,
  HttpClientResponse,
} from "effect/unstable/http";
import {
  CassetteStore,
  type CassetteStoreService,
  createEmptyCassette,
} from "./cassette-store";
import { buildRequestKey, redactRequest, redactResponse } from "./sanitize";
import type {
  VcrCassette,
  VcrCassetteFile,
  VcrConfig,
  VcrEntry,
  VcrRequest,
  VcrResponse,
} from "./types";
import { getVitestState } from "./vitest-state";

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
  return `${trimmed}${separator}${cassetteName}`;
};

/**
 * Resolve the cassette file path and export key.
 *
 * If explicit cassetteDir/cassetteName are provided, use them and default to
 * the "default" export. Otherwise infer from Vitest state:
 * - __cassettes__ folder next to the test file
 * - <test-file>.cassette file name
 * - export key = current test name (describe > test)
 */
const resolveCassetteLocation = (config: VcrConfig) => {
  if (config.cassetteDir && config.cassetteName) {
    return {
      path: cassettePath(config.cassetteDir, config.cassetteName),
      exportKey: "default",
    };
  }

  const { testPath, currentTestName } = getVitestState();
  if (!testPath || !currentTestName) {
    throw new Error(
      "VCR cassette path could not be inferred. Provide cassetteDir and cassetteName.",
    );
  }

  const separator = testPath.includes("\\") ? "\\" : "/";
  const segments = testPath.split(/[/\\]/);
  const fileName = segments[segments.length - 1] ?? "test";
  const dir = segments.slice(0, -1).join(separator);
  const cassetteDir = `${dir}${separator}__cassettes__`;
  const cassetteName = `${fileName}.cassette`;
  return {
    path: cassettePath(cassetteDir, cassetteName),
    exportKey: currentTestName,
  };
};

/**
 * Apply defaults for common VCR behavior while preserving explicit overrides.
 */
const normalizeConfig = (config: VcrConfig) => ({
  connectorName: config.connectorName,
  cassetteDir: config.cassetteDir,
  cassetteName: config.cassetteName,
  mode: config.mode ?? "auto",
  matchIgnore: {
    requestHeaders: ["authorization"],
    ...config.matchIgnore,
  },
  redact: {
    requestHeaders: ["authorization"],
    ...config.redact,
  },
  match: config.match,
});

const AckDisableVcrConfig = Config.option(
  Config.string("ACK_DISABLE_VCR"),
).pipe(
  Config.map((value) =>
    Option.match(value, {
      onNone: () => new Set<string>(),
      onSome: (raw) =>
        new Set(
          raw
            .split(",")
            .map((segment) => segment.trim().toLowerCase())
            .filter((segment) => segment.length > 0),
        ),
    }),
  ),
);

const shouldDisableVcr = (options: {
  readonly connectorName: string;
  readonly disabledConnectors: ReadonlySet<string>;
}): boolean => {
  const normalized = options.connectorName.trim().toLowerCase();
  return options.disabledConnectors.has(normalized);
};

/**
 * Convert store or replay failures into HttpClient transport errors.
 */
const toRequestError = (
  request: HttpClientRequest.HttpClientRequest,
  cause: unknown,
  description?: string,
) =>
  new HttpClientError.HttpClientError({
    reason: new HttpClientError.TransportError({
      request,
      cause,
      description,
    }),
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
const readCassetteFile = (
  path: string,
  store: CassetteStoreService,
  request: HttpClientRequest.HttpClientRequest,
): Effect.Effect<VcrCassetteFile, HttpClientError.HttpClientError> =>
  store
    .load(path)
    .pipe(Effect.mapError((error) => toRequestError(request, error)));

/**
 * Load a cassette or initialize a new one if missing.
 */
const loadOrInitCassetteFile = (
  path: string,
  store: CassetteStoreService,
  request: HttpClientRequest.HttpClientRequest,
): Effect.Effect<VcrCassetteFile, HttpClientError.HttpClientError> =>
  store
    .loadOrInit(path)
    .pipe(Effect.mapError((error) => toRequestError(request, error)));

/**
 * Persist the updated cassette.
 */
const saveCassetteFile = (
  path: string,
  store: CassetteStoreService,
  cassette: VcrCassetteFile,
  request: HttpClientRequest.HttpClientRequest,
): Effect.Effect<void, HttpClientError.HttpClientError> =>
  store
    .save(path, cassette)
    .pipe(Effect.mapError((error) => toRequestError(request, error)));

/**
 * Load a named cassette export from the file, or return a fresh empty cassette.
 */
const readCassetteExport = (
  path: string,
  exportKey: string,
  store: CassetteStoreService,
  request: HttpClientRequest.HttpClientRequest,
): Effect.Effect<VcrCassette, HttpClientError.HttpClientError> =>
  readCassetteFile(path, store, request).pipe(
    Effect.flatMap((file) => {
      const found = file.exports[exportKey];
      if (found) return Effect.succeed(found);
      return createEmptyCassette();
    }),
  );

/**
 * Locate a cassette entry by custom matcher or stable request key.
 */
const findEntry = (
  request: VcrRequest,
  cassette: VcrCassette,
  config: VcrConfig,
): Effect.Effect<VcrEntry | undefined> => {
  if (config.match) {
    return Effect.succeed(
      Object.values(cassette.entries).find((entry) =>
        config.match?.(request, entry),
      ),
    );
  }
  return buildRequestKey(request, {
    ignoreHeaders: config.matchIgnore?.requestHeaders,
    ignoreBodyKeys: config.matchIgnore?.requestBodyKeys,
  }).pipe(Effect.map((key) => cassette.entries[key]));
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
  exportKey: string,
): Effect.Effect<
  HttpClientResponse.HttpClientResponse,
  HttpClientError.HttpClientError
> =>
  readCassetteExport(path, exportKey, store, request).pipe(
    Effect.flatMap((cassette) => {
      return findEntry(vcrRequest, cassette, config).pipe(
        Effect.flatMap((entry) => {
          if (!entry) {
            return Effect.fail(
              new HttpClientError.HttpClientError({
                reason: new HttpClientError.TransportError({
                  request,
                  description: `VCR replay missing entry for ${request.method} ${request.url}`,
                }),
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
  exportKey: string,
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
    const file = yield* loadOrInitCassetteFile(path, store, request);
    const cassette = file.exports[exportKey] ?? (yield* createEmptyCassette());
    const key = yield* buildRequestKey(vcrRequest, {
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
    const nextFile: VcrCassetteFile = {
      ...file,
      exports: {
        ...file.exports,
        [exportKey]: next,
      },
    };
    // Persist updated cassette to disk.
    yield* saveCassetteFile(path, store, nextFile, request);
    return response;
  });

/**
 * Build a VCR-aware HttpClient that replays or records per config.
 */
export const makeVcrHttpClient = (
  live: HttpClient.HttpClient,
  config: VcrConfig,
) =>
  Effect.gen(function* () {
    const normalized = normalizeConfig(config);
    const isCi = yield* Config.boolean("CI").pipe(Config.withDefault(false));
    const disabledVcrConnectors = yield* AckDisableVcrConfig;
    const vcrDisabledForConnector = shouldDisableVcr({
      connectorName: normalized.connectorName,
      disabledConnectors: disabledVcrConnectors,
    });

    if (vcrDisabledForConnector) {
      return live;
    }

    // CassetteStore is provided via Layer for platform-specific persistence.
    const store = yield* CassetteStore;
    const { path, exportKey } = resolveCassetteLocation(normalized);

    const client = live.pipe(
      HttpClient.transform((effect, request) => {
        return Effect.gen(function* () {
          const vcrRequest = toVcrRequest(request);
          if (normalized.mode === "replay") {
            return yield* replay(
              request,
              vcrRequest,
              normalized,
              store,
              path,
              exportKey,
            );
          }

          if (normalized.mode === "record") {
            return yield* record(
              request,
              vcrRequest,
              effect,
              normalized,
              store,
              path,
              exportKey,
            );
          }

          // Auto mode: replay if cassette exists, otherwise record (or fail in CI).
          const available = yield* store
            .exists(path)
            .pipe(Effect.mapError((error) => toRequestError(request, error)));

          if (!available) {
            if (isCi) {
              return yield* Effect.fail(
                new HttpClientError.HttpClientError({
                  reason: new HttpClientError.TransportError({
                    request,
                    description: "VCR cassette missing in CI for auto mode",
                  }),
                }),
              );
            }
            return yield* record(
              request,
              vcrRequest,
              effect,
              normalized,
              store,
              path,
              exportKey,
            );
          }

          const cassette = yield* readCassetteExport(
            path,
            exportKey,
            store,
            request,
          );
          const entry = yield* findEntry(vcrRequest, cassette, normalized);

          if (entry) {
            const web = new Response(entry.response.body, {
              status: entry.response.status,
              headers: entry.response.headers,
            });
            return HttpClientResponse.fromWeb(request, web);
          }

          return yield* record(
            request,
            vcrRequest,
            effect,
            normalized,
            store,
            path,
            exportKey,
          );
        });
      }),
    );

    return client;
  });

/**
 * Layer that provides a VCR-wrapped HttpClient.
 */
export const layer = (config: VcrConfig) =>
  HttpClient.layerMergedServices(
    Effect.gen(function* () {
      const live = yield* HttpClient.HttpClient;
      return yield* makeVcrHttpClient(live, config);
    }),
  );
