import { ConnectorError, Telemetry } from "@useairfoil/connector-kit";
import { Config, Context, Effect, Layer, Option, Schema } from "effect";
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/unstable/http";

import type { PolarConfig } from "./connector";

import { type ListResponse, makeListResponseSchema } from "./schemas";

export type PolarApiClientService = {
  readonly fetchJson: <A, R>(
    schema: Schema.Decoder<A, R>,
    path: string,
    params?: Record<string, string>,
  ) => Effect.Effect<A, ConnectorError, R>;
  readonly fetchList: <A, R>(
    schema: Schema.Decoder<A, R>,
    path: string,
    options: {
      readonly page: number;
      readonly limit: number;
      readonly sorting: string;
    },
  ) => Effect.Effect<ListResponse<A>, ConnectorError, R>;
};

export class PolarApiClient extends Context.Service<PolarApiClient, PolarApiClientService>()(
  "@useairfoil/producer-polar/PolarApiClient",
) {}

export const make = Effect.fnUntraced(function* (
  config: PolarConfig,
): Effect.fn.Return<PolarApiClientService, ConnectorError, HttpClient.HttpClient> {
  const client = (yield* HttpClient.HttpClient).pipe(
    HttpClient.mapRequest(HttpClientRequest.prependUrl(config.apiBaseUrl)),
    HttpClient.mapRequest(HttpClientRequest.bearerToken(config.accessToken)),
    HttpClient.mapRequest(HttpClientRequest.acceptJson),
  );

  const fetchJson = <A, R>(
    schema: Schema.Decoder<A, R>,
    path: string,
    params?: Record<string, string>,
  ): Effect.Effect<A, ConnectorError, R> => {
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
      Effect.withSpan(Telemetry.SpanName.apiFetch, {
        kind: "client",
        attributes: { [Telemetry.Attr.apiPath]: path },
      }),
    );
  };

  const fetchList = <A, R>(
    schema: Schema.Decoder<A, R>,
    path: string,
    options: {
      readonly page: number;
      readonly limit: number;
      readonly sorting: string;
    },
  ): Effect.Effect<ListResponse<A>, ConnectorError, R> => {
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

export const layer = (
  config: PolarConfig,
): Layer.Layer<PolarApiClient, ConnectorError, HttpClient.HttpClient> =>
  Layer.effect(PolarApiClient)(make(config));

export const layerConfig = (
  config: Config.Wrap<PolarConfig>,
): Layer.Layer<PolarApiClient, ConnectorError | Config.ConfigError, HttpClient.HttpClient> =>
  Layer.effect(PolarApiClient)(Config.unwrap(config).asEffect().pipe(Effect.flatMap(make)));
