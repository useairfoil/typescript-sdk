import { ConnectorError } from "@useairfoil/connector-kit";
import { Context, Effect, Layer, Schema } from "effect";
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
    },
  ) => Effect.Effect<TemplateListPage<A>, ConnectorError, R>;
};

export class TemplateApiClient extends Context.Service<
  TemplateApiClient,
  TemplateApiClientService
>()("@useairfoil/producer-template/TemplateApiClient") {}

// Factory that resolves an HttpClient via the layer it is provided into and
// returns a small typed API surface. The auth header is Bearer by default;
// swap it out for `setHeader("X-Api-Key", ...)`, Basic auth, or OAuth2 as
// required by your upstream API.
export const makeTemplateApiClient = (
  config: TemplateConfig,
): Effect.Effect<TemplateApiClientService, ConnectorError, HttpClient.HttpClient> =>
  Effect.fnUntraced(function* () {
    const client = (yield* HttpClient.HttpClient).pipe(
      HttpClient.mapRequest(HttpClientRequest.prependUrl(config.apiBaseUrl)),
      HttpClient.mapRequest(HttpClientRequest.bearerToken(config.apiToken)),
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
          Effect.flatMap(HttpClientResponse.filterStatusOk),
          Effect.flatMap((response) => response.json),
          Effect.flatMap(Schema.decodeUnknownEffect(schema)),
          Effect.mapError(
            (error) =>
              new ConnectorError({
                message: "Template API request failed",
                cause: error,
              }),
          ),
        ),
      );
    };

    const fetchList = <A, R>(
      schema: Schema.Decoder<A, R>,
      path: string,
      options: {
        readonly page: number;
        readonly limit: number;
      },
    ): Effect.Effect<TemplateListPage<A>, ConnectorError, R> => {
      const params: Record<string, string> = {
        _page: String(options.page),
        _limit: String(options.limit),
      };
      const arraySchema = Schema.Array(schema) as unknown as Schema.Decoder<ReadonlyArray<A>, R>;
      return fetchJson(arraySchema, path, params).pipe(
        Effect.map((items) => ({
          items,
          hasMore: items.length === options.limit,
        })),
      );
    };

    return { fetchJson, fetchList };
  })();

export const layerApiClient = (
  config: TemplateConfig,
): Layer.Layer<TemplateApiClient, ConnectorError, HttpClient.HttpClient> =>
  Layer.effect(TemplateApiClient)(makeTemplateApiClient(config));
