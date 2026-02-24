import { ConnectorError } from "@useairfoil/connector-kit";
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

export const fetchJson = <T>(
  config: PolarConfig,
  path: string,
  params?: Record<string, string>,
): Effect.Effect<T, ConnectorError> =>
  Effect.tryPromise({
    try: async () => {
      const url = new URL(path, BASE_URL);
      if (params) {
        for (const [key, value] of Object.entries(params)) {
          url.searchParams.set(key, value);
        }
      }

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new ConnectorError({
          message: `Polar API ${response.status}: ${body}`,
        });
      }

      return (await response.json()) as T;
    },
    catch: (error) =>
      error instanceof ConnectorError
        ? error
        : new ConnectorError({ message: "Polar request failed", cause: error }),
  });

export const fetchList = <T>(
  config: PolarConfig,
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

  return fetchJson<ListResponse<T>>(config, path, params);
};
