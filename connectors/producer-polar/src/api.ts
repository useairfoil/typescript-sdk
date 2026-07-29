import { ConnectorError, Telemetry } from "@useairfoil/connector-kit";
import { Config, Context, Duration, Effect, Layer, Option, Schedule, Schema } from "effect";
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/unstable/http";
import { RateLimiter } from "effect/unstable/persistence";

import type { PolarConfig } from "./manifest";

import { type ListResponse, makeListResponseSchema } from "./schemas";

export type PolarApiClientService = {
  readonly fetchJson: <A>(
    schema: Schema.Decoder<A>,
    path: string,
    params?: Record<string, string>,
  ) => Effect.Effect<A, ConnectorError>;
  readonly fetchList: <A>(
    schema: Schema.Decoder<A>,
    path: string,
    options: {
      readonly page: number;
      readonly limit: number;
      readonly sorting: string;
    },
  ) => Effect.Effect<ListResponse<A>, ConnectorError>;
};

export class PolarApiClient extends Context.Service<PolarApiClient, PolarApiClientService>()(
  "@useairfoil/producer-polar/PolarApiClient",
) {}

// Polar allows 500 requests per minute in production and 100 in sandbox.
const sandboxHostname = "sandbox-api.polar.sh";

const isSandbox = (apiBaseUrl: string): boolean => {
  try {
    return new URL(apiBaseUrl).hostname === sandboxHostname;
  } catch {
    return false;
  }
};

export const make = Effect.fnUntraced(function* (config: PolarConfig) {
  const limiter = yield* RateLimiter.RateLimiter;
  const rateLimitPerMinute = Option.getOrElse(config.rateLimitPerMinute, () =>
    isSandbox(config.apiBaseUrl) ? 100 : 500,
  );
  const retrySchedule = Schedule.exponential(Duration.millis(config.retryBaseDelayMs)).pipe(
    Schedule.jittered,
  );
  const requestTimeout = Duration.seconds(config.requestTimeoutSeconds);
  const client = (yield* HttpClient.HttpClient).pipe(
    HttpClient.mapRequest(HttpClientRequest.prependUrl(config.apiBaseUrl)),
    HttpClient.mapRequest(HttpClientRequest.bearerToken(config.accessToken)),
    HttpClient.mapRequest(HttpClientRequest.acceptJson),
    HttpClient.withRateLimiter({
      limiter,
      key: "polar",
      limit: rateLimitPerMinute,
      window: "1 minute",
      algorithm: "token-bucket",
    }),
    HttpClient.retryTransient({
      schedule: retrySchedule,
      times: config.transientMaxRetries,
    }),
  );

  // withRateLimiter has no retry limit for 429 responses.
  // This timeout prevents a request from running forever.
  const fetchJson = <A>(
    schema: Schema.Decoder<A>,
    path: string,
    params?: Record<string, string>,
  ): Effect.Effect<A, ConnectorError> => {
    const request = params
      ? HttpClientRequest.get(path).pipe(HttpClientRequest.setUrlParams(params))
      : HttpClientRequest.get(path);
    return Effect.scoped(
      client.execute(request).pipe(
        Effect.tapError((error) => Telemetry.annotateError("api_http", error)),
        Effect.mapError(
          (error) => new ConnectorError({ message: "Polar API request failed", cause: error }),
        ),
        Effect.flatMap((response) =>
          HttpClientResponse.filterStatusOk(response).pipe(
            Effect.tapError((error) => Telemetry.annotateError("api_status", error)),
            Effect.mapError(
              (error) =>
                new ConnectorError({
                  message: "Polar API returned non-2xx status",
                  cause: error,
                }),
            ),
          ),
        ),
        Effect.flatMap((response) =>
          response.json.pipe(
            Effect.tapError((error) => Telemetry.annotateError("api_json", error)),
            Effect.mapError(
              (error) =>
                new ConnectorError({ message: "Polar API returned invalid JSON", cause: error }),
            ),
          ),
        ),
        Effect.flatMap((json) =>
          Schema.decodeUnknownEffect(schema)(json).pipe(
            Effect.tapError((error) => Telemetry.annotateError("api_decode", error)),
            Effect.mapError(
              (error) =>
                new ConnectorError({
                  message: "Polar API response schema decode failed",
                  cause: error,
                }),
            ),
          ),
        ),
      ),
    ).pipe(
      Effect.timeout(requestTimeout),
      Effect.mapError((error) =>
        error instanceof ConnectorError
          ? error
          : new ConnectorError({ message: "Polar API request timed out", cause: error }),
      ),
      Effect.withSpan(Telemetry.SpanName.apiFetch, {
        kind: "client",
        attributes: { [Telemetry.Attr.apiPath]: path },
      }),
    );
  };

  const fetchList = <A>(
    schema: Schema.Decoder<A>,
    path: string,
    options: {
      readonly page: number;
      readonly limit: number;
      readonly sorting: string;
    },
  ): Effect.Effect<ListResponse<A>, ConnectorError> => {
    const params: Record<string, string> = {
      page: String(options.page),
      limit: String(options.limit),
      sorting: options.sorting,
    };

    if (Option.isSome(config.organizationId)) {
      params.organization_id = config.organizationId.value;
    }

    return fetchJson(makeListResponseSchema(schema), path, params);
  };

  return { fetchJson, fetchList };
});

// Each process runs one connector instance, so rate limit state stays in memory.
const RateLimiterLive = RateLimiter.layer.pipe(Layer.provide(RateLimiter.layerStoreMemory));

export const layer = (
  config: PolarConfig,
): Layer.Layer<PolarApiClient, ConnectorError, HttpClient.HttpClient> =>
  Layer.effect(PolarApiClient)(make(config)).pipe(Layer.provide(RateLimiterLive));

export const layerConfig = (
  config: Config.Wrap<PolarConfig>,
): Layer.Layer<PolarApiClient, ConnectorError | Config.ConfigError, HttpClient.HttpClient> =>
  Layer.effect(PolarApiClient)(Config.unwrap(config).pipe(Effect.flatMap(make))).pipe(
    Layer.provide(RateLimiterLive),
  );
