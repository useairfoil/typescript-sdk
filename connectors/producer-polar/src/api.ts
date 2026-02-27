import { HttpClient, HttpClientRequest } from "@effect/platform";
import { ConnectorError } from "@useairfoil/connector-kit";
import { Context, Effect, Layer, Schema } from "effect";
import type { PolarConfig } from "./connector";
import { ListResponseSchema } from "./schemas";

export type ListResponse<T> = {
  readonly items: ReadonlyArray<T>;
  readonly pagination: {
    readonly total_count: number;
    readonly max_page: number;
  };
};

export type PolarApiClientService = {
  readonly fetchJson: <T>(
    path: string,
    params?: Record<string, string>,
  ) => Effect.Effect<T, ConnectorError>;
  readonly fetchList: <T>(
    path: string,
    options: {
      readonly page: number;
      readonly limit: number;
      readonly sorting: string;
    },
  ) => Effect.Effect<ListResponse<T>, ConnectorError>;
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

    const fetchJson = <T>(
      path: string,
      params?: Record<string, string>,
    ): Effect.Effect<T, ConnectorError> =>
      Effect.gen(function* () {
        const request = params
          ? HttpClientRequest.get(path).pipe(
              HttpClientRequest.setUrlParams(params),
            )
          : HttpClientRequest.get(path);
        const response = yield* client.execute(request).pipe(
          Effect.mapError(
            (error) =>
              new ConnectorError({
                message: "Polar request failed",
                cause: error,
              }),
          ),
        );

        const body = yield* response.text.pipe(
          Effect.mapError(
            (error) =>
              new ConnectorError({
                message: "Polar response read failed",
                cause: error,
              }),
          ),
        );

        if (response.status < 200 || response.status >= 300) {
          return yield* Effect.fail(
            new ConnectorError({
              message: `Polar API ${response.status}: ${body}`,
            }),
          );
        }

        const parsed = yield* Effect.try({
          try: () => JSON.parse(body) as T,
          catch: (error) => error,
        }).pipe(
          Effect.mapError(
            (error) =>
              new ConnectorError({
                message: "Polar response parse failed",
                cause: error,
              }),
          ),
        );

        return parsed;
      });

    const fetchList = <T>(
      path: string,
      options: {
        readonly page: number;
        readonly limit: number;
        readonly sorting: string;
      },
    ): Effect.Effect<ListResponse<T>, ConnectorError> => {
      const params: Record<string, string> = {
        page: String(options.page),
        limit: String(options.limit),
        sorting: options.sorting,
      };

      if (config.organizationId) {
        params.organization_id = config.organizationId;
      }

      return fetchJson<ListResponse<T>>(path, params).pipe(
        Effect.flatMap((payload) =>
          Schema.decodeUnknown(ListResponseSchema)(payload).pipe(
            Effect.map((decoded) => decoded as ListResponse<T>),
            Effect.mapError(
              (error) =>
                new ConnectorError({
                  message: "Polar list response schema failed",
                  cause: error,
                }),
            ),
          ),
        ),
      );
    };

    return { fetchJson, fetchList };
  });

export const PolarApiClientConfig = (
  config: PolarConfig,
): Layer.Layer<PolarApiClient, ConnectorError, HttpClient.HttpClient> =>
  Layer.effect(PolarApiClient, makePolarApiClient(config));
