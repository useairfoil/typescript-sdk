import { ConnectorError } from "@useairfoil/connector-kit";
import {
  makeVcrFetch,
  type VcrConfig,
  type VcrRequest,
} from "@useairfoil/connector-kit/vcr";
import { Effect } from "effect";
import type { PolarConfig } from "./index";

const BASE_URL = "https://sandbox-api.polar.sh/v1/";

export type ListResponse<T> = {
  readonly items: ReadonlyArray<T>;
  readonly pagination: {
    readonly total_count: number;
    readonly max_page: number;
  };
};

export type PolarApiClient = {
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

const buildUrl = (path: string, params?: Record<string, string>) => {
  const url = new URL(path, BASE_URL);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
};

const makeRealFetch = (config: PolarConfig) => (request: VcrRequest) =>
  Effect.tryPromise({
    try: async () => {
      const response = await fetch(request.url, {
        method: request.method,
        headers: request.headers ?? {
          Authorization: `Bearer ${config.accessToken}`,
          Accept: "application/json",
        },
        body: request.body,
      });

      return {
        status: response.status,
        body: await response.text(),
        headers: Object.fromEntries(response.headers.entries()),
      };
    },
    catch: (error) =>
      new ConnectorError({ message: "Polar request failed", cause: error }),
  });

export const makePolarApiClient = (
  config: PolarConfig,
  options?: {
    readonly vcr?: VcrConfig;
  },
): Effect.Effect<PolarApiClient, ConnectorError> =>
  Effect.gen(function* () {
    const realFetch = makeRealFetch(config);
    const fetcher = options?.vcr
      ? yield* makeVcrFetch(options.vcr, realFetch)
      : realFetch;

    const fetchJson = <T>(
      path: string,
      params?: Record<string, string>,
    ): Effect.Effect<T, ConnectorError> =>
      Effect.gen(function* () {
        const url = buildUrl(path, params);
        const headers = {
          Accept: "application/json",
          Authorization: `Bearer ${config.accessToken}`,
        };
        const response = yield* fetcher({ method: "GET", url, headers });

        if (response.status < 200 || response.status >= 300) {
          return yield* Effect.fail(
            new ConnectorError({
              message: `Polar API ${response.status}: ${response.body}`,
            }),
          );
        }

        const parsed = yield* Effect.try({
          try: () => JSON.parse(response.body) as T,
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

      return fetchJson<ListResponse<T>>(path, params);
    };

    return { fetchJson, fetchList };
  });
