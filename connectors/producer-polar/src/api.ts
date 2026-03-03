import {
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
} from "@effect/platform";
import { ConnectorError } from "@useairfoil/connector-kit";
import { Context, Effect, Layer, type Schema } from "effect";
import type { PolarConfig } from "./connector";
import { type ListResponse, makeListResponseSchema } from "./schemas";

export type PolarApiClientService = {
  readonly fetchJson: <A, I, R>(
    schema: Schema.Schema<A, I, R>,
    path: string,
    params?: Record<string, string>,
  ) => Effect.Effect<A, ConnectorError, R>;
  readonly fetchList: <A, I, R>(
    schema: Schema.Schema<A, I, R>,
    path: string,
    options: {
      readonly page: number;
      readonly limit: number;
      readonly sorting: string;
    },
  ) => Effect.Effect<ListResponse<A>, ConnectorError, R>;
};

export class PolarApiClient extends Context.Tag(
  "@useairfoil/producer-polar/PolarApiClient",
)<PolarApiClient, PolarApiClientService>() {}

export const makePolarApiClient = (
  config: PolarConfig,
): Effect.Effect<
  PolarApiClientService,
  ConnectorError,
  HttpClient.HttpClient
> =>
  Effect.gen(function* () {
    const client = (yield* HttpClient.HttpClient).pipe(
      HttpClient.mapRequest(HttpClientRequest.prependUrl(config.apiBaseUrl)),
      HttpClient.mapRequest(HttpClientRequest.bearerToken(config.accessToken)),
      HttpClient.mapRequest(HttpClientRequest.acceptJson),
    );

    const fetchJson = <A, I, R>(
      schema: Schema.Schema<A, I, R>,
      path: string,
      params?: Record<string, string>,
    ): Effect.Effect<A, ConnectorError, R> => {
      const request = params
        ? HttpClientRequest.get(path).pipe(
            HttpClientRequest.setUrlParams(params),
          )
        : HttpClientRequest.get(path);
      return client.execute(request).pipe(
        Effect.flatMap(HttpClientResponse.filterStatusOk),
        Effect.flatMap(HttpClientResponse.schemaBodyJson(schema)),
        Effect.mapError(
          (error) =>
            new ConnectorError({
              message: "Polar API request failed",
              cause: error,
            }),
        ),
      );
    };

    const fetchList = <A, I, R>(
      schema: Schema.Schema<A, I, R>,
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

      if (config.organizationId) {
        params.organization_id = config.organizationId;
      }

      const request = HttpClientRequest.get(path).pipe(
        HttpClientRequest.setUrlParams(params),
      );

      return client.execute(request).pipe(
        Effect.flatMap(HttpClientResponse.filterStatusOk),
        Effect.flatMap(
          HttpClientResponse.schemaBodyJson(makeListResponseSchema(schema)),
        ),
        Effect.mapError(
          (error) =>
            new ConnectorError({
              message: "Polar API request failed",
              cause: error,
            }),
        ),
      );
    };

    return { fetchJson, fetchList };
  });

export const PolarApiClientConfig = (
  config: PolarConfig,
): Layer.Layer<PolarApiClient, ConnectorError, HttpClient.HttpClient> =>
  Layer.effect(PolarApiClient, makePolarApiClient(config));
