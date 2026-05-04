import { ConnectorError } from "@useairfoil/connector-kit";
import { Context, Effect, Layer, Schema } from "effect";
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/unstable/http";

import type { ShopifyConfig } from "./connector";

// Page of rows returned by the list helper.
export type ShopifyListPage<A> = {
  readonly items: ReadonlyArray<A>;
  readonly nextUrl: string | null;
  readonly hasMore: boolean;
};

export type ShopifyApiClientService = {
  readonly fetchJson: <A, R>(
    schema: Schema.Decoder<A, R>,
    path: string,
    params?: Record<string, string>,
  ) => Effect.Effect<A, ConnectorError, R>;
  readonly fetchList: <A, R>(
    schema: Schema.Decoder<A, R>,
    path: string,
    options: {
      readonly limit: number;
      readonly nextUrl?: string;
    },
  ) => Effect.Effect<ShopifyListPage<A>, ConnectorError, R>;
};

export class ShopifyApiClient extends Context.Service<ShopifyApiClient, ShopifyApiClientService>()(
  "@useairfoil/producer-shopify/ShopifyApiClient",
) {}

const extractNextUrl = (linkHeader: string | undefined): string | null => {
  if (!linkHeader) {
    return null;
  }
  const match = linkHeader.match(/<([^>]+)>;\s*rel="?next"?/i);
  return match?.[1] ?? null;
};

const inferListField = (path: string): string => {
  const [firstSegment] = path.split("?");
  const finalSegment = firstSegment?.split("/").at(-1) ?? "";
  return finalSegment.replace(/\.json$/i, "");
};

const isAbsoluteUrl = (value: string): boolean => /^https?:\/\//i.test(value);

export const makeShopifyApiClient = Effect.fnUntraced(function* (
  config: ShopifyConfig,
): Effect.fn.Return<ShopifyApiClientService, ConnectorError, HttpClient.HttpClient> {
  const rawClient = yield* HttpClient.HttpClient;
  const authAndJsonClient = rawClient.pipe(
    HttpClient.mapRequest(HttpClientRequest.setHeader("X-Shopify-Access-Token", config.apiToken)),
    HttpClient.mapRequest(HttpClientRequest.acceptJson),
  );
  const relativePathClient = authAndJsonClient.pipe(
    HttpClient.mapRequest(HttpClientRequest.prependUrl(config.apiBaseUrl)),
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
      relativePathClient.execute(request).pipe(
        Effect.flatMap(HttpClientResponse.filterStatusOk),
        Effect.flatMap((response) => response.json),
        Effect.flatMap(Schema.decodeUnknownEffect(schema)),
        Effect.mapError(
          (error) =>
            new ConnectorError({
              message: "Shopify API request failed",
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
      readonly limit: number;
      readonly nextUrl?: string;
    },
  ): Effect.Effect<ShopifyListPage<A>, ConnectorError, R> => {
    const useAbsolute = typeof options.nextUrl === "string" && isAbsoluteUrl(options.nextUrl);
    const client = useAbsolute ? authAndJsonClient : relativePathClient;
    const request = options.nextUrl
      ? HttpClientRequest.get(options.nextUrl)
      : HttpClientRequest.get(`${path}?limit=${options.limit}`);
    const arraySchema = Schema.Array(schema) as unknown as Schema.Decoder<ReadonlyArray<A>, R>;
    const listField = inferListField(path);

    return Effect.scoped(
      client.execute(request).pipe(
        Effect.flatMap(HttpClientResponse.filterStatusOk),
        Effect.flatMap((response) =>
          Effect.all({
            body: response.json,
            linkHeader: Effect.succeed(response.headers["link"]),
          }),
        ),
        Effect.flatMap(({ body, linkHeader }) => {
          const unknownEnvelope = body as Record<string, unknown>;
          const unknownItems = unknownEnvelope[listField];
          return Schema.decodeUnknownEffect(arraySchema)(unknownItems).pipe(
            Effect.map((items) => {
              const nextUrl = extractNextUrl(linkHeader);
              return {
                items,
                nextUrl,
                hasMore: nextUrl !== null,
              };
            }),
          );
        }),
        Effect.mapError(
          (error) =>
            new ConnectorError({
              message: "Shopify list request failed",
              cause: error,
            }),
        ),
      ),
    );
  };

  return { fetchJson, fetchList };
});

export const layerApiClient = (
  config: ShopifyConfig,
): Layer.Layer<ShopifyApiClient, ConnectorError, HttpClient.HttpClient> =>
  Layer.effect(ShopifyApiClient)(makeShopifyApiClient(config));
