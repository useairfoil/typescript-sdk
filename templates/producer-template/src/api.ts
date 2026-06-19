import { ConnectorError, Telemetry } from "@useairfoil/connector-kit";
import { Config, Context, Effect, Layer, Schema } from "effect";
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/unstable/http";

import type { TemplateConfig } from "./connector";

// Page of rows returned by the list helper. When porting to a real API, prefer
// returning whatever the API returns (total count, next token, link header)
// and handle pagination inside the stream layer rather than here.
export type TemplateListPage<A> = {
  readonly items: ReadonlyArray<A>;
  readonly hasMore: boolean;
};

export type TemplateApiClientService = {
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
    },
  ) => Effect.Effect<TemplateListPage<A>, ConnectorError>;
};

export class TemplateApiClient extends Context.Service<
  TemplateApiClient,
  TemplateApiClientService
>()("@useairfoil/producer-template/TemplateApiClient") {}

// Factory that resolves an HttpClient via the layer it is provided into and
// returns a small typed API surface. The auth header is Bearer by default;
// swap it out for `setHeader("X-Api-Key", ...)`, Basic auth, or OAuth2 as
// required by your upstream API.
export const make = Effect.fnUntraced(function* (config: TemplateConfig) {
  const client = (yield* HttpClient.HttpClient).pipe(
    HttpClient.mapRequest(HttpClientRequest.prependUrl(config.apiBaseUrl)),
    HttpClient.mapRequest(HttpClientRequest.bearerToken(config.apiToken)),
    HttpClient.mapRequest(HttpClientRequest.acceptJson),
  );

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
          (error) => new ConnectorError({ message: "Template API request failed", cause: error }),
        ),
        Effect.flatMap((response) =>
          HttpClientResponse.filterStatusOk(response).pipe(
            Effect.tapError((error) => Telemetry.annotateError("api_status", error)),
            Effect.mapError(
              (error) =>
                new ConnectorError({
                  message: "Template API returned non-2xx status",
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
                new ConnectorError({
                  message: "Template API returned invalid JSON",
                  cause: error,
                }),
            ),
          ),
        ),
        Effect.flatMap((json) =>
          Schema.decodeUnknownEffect(schema)(json).pipe(
            Effect.tapError((error) => Telemetry.annotateError("api_decode", error)),
            Effect.mapError(
              (error) =>
                new ConnectorError({
                  message: "Template API response schema decode failed",
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

  const fetchList = <A>(
    schema: Schema.Decoder<A>,
    path: string,
    options: {
      readonly page: number;
      readonly limit: number;
    },
  ): Effect.Effect<TemplateListPage<A>, ConnectorError> => {
    const params: Record<string, string> = {
      _page: String(options.page),
      _limit: String(options.limit),
    };
    return fetchJson(Schema.Array(schema), path, params).pipe(
      Effect.map((items) => ({
        items,
        hasMore: items.length === options.limit,
      })),
    );
  };

  return { fetchJson, fetchList };
});

export const layer = (
  config: TemplateConfig,
): Layer.Layer<TemplateApiClient, ConnectorError, HttpClient.HttpClient> =>
  Layer.effect(TemplateApiClient)(make(config));

export const layerConfig = (
  config: Config.Wrap<TemplateConfig>,
): Layer.Layer<TemplateApiClient, ConnectorError | Config.ConfigError, HttpClient.HttpClient> =>
  Layer.effect(TemplateApiClient)(Config.unwrap(config).pipe(Effect.flatMap(make)));
