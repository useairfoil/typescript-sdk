import { ConnectorError, Telemetry } from "@useairfoil/connector-kit";
import { Config, Context, Effect, Layer, Schema } from "effect";
import { HttpClient, HttpClientRequest } from "effect/unstable/http";

import type { ShopifyConfig } from "./connector";
import type { Product } from "./schemas";

import {
  PageInfoSchema,
  ProductOptionSchema,
  ProductStatusSchema,
  ProductVariantInventoryPolicySchema,
} from "./schemas";

export type ShopifyProductPage = {
  readonly items: ReadonlyArray<Product>;
  readonly endCursor: string | null;
  readonly hasMore: boolean;
};

export type ShopifyApiClientService = {
  readonly fetchGraphQL: <A>(options: {
    readonly operationName: string;
    readonly query: string;
    readonly variables?: Record<string, unknown>;
    readonly schema: Schema.Decoder<A>;
  }) => Effect.Effect<A, ConnectorError>;
  readonly fetchProducts: (options: {
    readonly first: number;
    readonly after?: string;
  }) => Effect.Effect<ShopifyProductPage, ConnectorError>;
};

export class ShopifyApiClient extends Context.Service<ShopifyApiClient, ShopifyApiClientService>()(
  "@useairfoil/producer-shopify/ShopifyApiClient",
) {}

const ProductsQuery = `#graphql
query AirfoilProducts($first: Int!, $after: String) {
  products(first: $first, after: $after, sortKey: UPDATED_AT, reverse: true) {
    nodes {
      id
      legacyResourceId
      title
      handle
      descriptionHtml
      productType
      vendor
      status
      tags
      createdAt
      updatedAt
      publishedAt
      templateSuffix
      featuredMedia {
        ... on MediaImage {
          image {
            url
            altText
          }
        }
      }
      options(first: 100) {
        id
        name
        position
        values
      }
      variants(first: 25) {
        nodes {
          id
          legacyResourceId
          title
          sku
          barcode
          price
          compareAtPrice
          inventoryPolicy
          taxable
          createdAt
          updatedAt
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
`;

const LegacyResourceIdSchema = Schema.Union([Schema.String, Schema.Number]);

const GraphQLProductVariantNodeSchema = Schema.Struct({
  id: Schema.String,
  legacyResourceId: LegacyResourceIdSchema,
  title: Schema.String,
  sku: Schema.NullOr(Schema.String),
  barcode: Schema.NullOr(Schema.String),
  price: Schema.String,
  compareAtPrice: Schema.NullOr(Schema.String),
  inventoryPolicy: ProductVariantInventoryPolicySchema,
  taxable: Schema.Boolean,
  createdAt: Schema.String,
  updatedAt: Schema.String,
});

const GraphQLProductNodeSchema = Schema.Struct({
  id: Schema.String,
  legacyResourceId: LegacyResourceIdSchema,
  title: Schema.String,
  handle: Schema.String,
  descriptionHtml: Schema.String,
  productType: Schema.String,
  vendor: Schema.String,
  status: ProductStatusSchema,
  tags: Schema.Array(Schema.String),
  createdAt: Schema.String,
  updatedAt: Schema.String,
  publishedAt: Schema.NullOr(Schema.String),
  templateSuffix: Schema.NullOr(Schema.String),
  featuredMedia: Schema.NullOr(Schema.Any),
  options: Schema.Array(ProductOptionSchema),
  variants: Schema.Struct({
    nodes: Schema.Array(GraphQLProductVariantNodeSchema),
    pageInfo: PageInfoSchema,
  }),
});

const GraphQLProductsDataSchema = Schema.Struct({
  products: Schema.Struct({
    nodes: Schema.Array(GraphQLProductNodeSchema),
    pageInfo: PageInfoSchema,
  }),
});

type GraphQLProductsData = Schema.Schema.Type<typeof GraphQLProductsDataSchema>;
type GraphQLProductNode = Schema.Schema.Type<typeof GraphQLProductNodeSchema>;

const normalizeProductNode = (node: GraphQLProductNode): Product => ({
  id: node.id,
  legacyResourceId: String(node.legacyResourceId),
  title: node.title,
  handle: node.handle,
  descriptionHtml: node.descriptionHtml,
  productType: node.productType,
  vendor: node.vendor,
  status: node.status,
  tags: node.tags,
  createdAt: node.createdAt,
  updatedAt: node.updatedAt,
  publishedAt: node.publishedAt,
  templateSuffix: node.templateSuffix,
  featuredMedia: node.featuredMedia,
  options: node.options,
  variantsFirstPage: node.variants.nodes.map((variant) => ({
    ...variant,
    legacyResourceId: String(variant.legacyResourceId),
  })),
  variantsPageInfo: node.variants.pageInfo,
});

const graphqlEndpoint = (config: ShopifyConfig): string => {
  const shopDomain = config.shopDomain.replace(/^https?:\/\//i, "").replace(/\/+$/g, "");
  return `https://${shopDomain}/admin/api/${config.apiVersion}/graphql.json`;
};

const hasGraphqlErrors = (body: unknown): boolean => {
  if (typeof body !== "object" || body === null) {
    return false;
  }
  const errors = (body as { readonly errors?: unknown }).errors;
  return Array.isArray(errors) && errors.length > 0;
};

const summarizeBody = (body: unknown): string => {
  try {
    return JSON.stringify(body);
  } catch {
    return String(body);
  }
};

export const make = Effect.fnUntraced(function* (config: ShopifyConfig) {
  const client = (yield* HttpClient.HttpClient).pipe(
    HttpClient.mapRequest(HttpClientRequest.setHeader("X-Shopify-Access-Token", config.apiToken)),
    HttpClient.mapRequest(HttpClientRequest.acceptJson),
  );
  const endpoint = graphqlEndpoint(config);

  const fetchGraphQL = <A>(options: {
    readonly operationName: string;
    readonly query: string;
    readonly variables?: Record<string, unknown>;
    readonly schema: Schema.Decoder<A>;
  }): Effect.Effect<A, ConnectorError> =>
    Effect.gen(function* () {
      const request = yield* HttpClientRequest.post(endpoint).pipe(
        HttpClientRequest.bodyJson({
          query: options.query,
          variables: options.variables ?? {},
        }),
        Effect.mapError(
          (cause) =>
            new ConnectorError({ message: "Failed to encode Shopify GraphQL request", cause }),
        ),
      );

      const { body, status } = yield* Effect.scoped(
        client.execute(request).pipe(
          Effect.tapError((error) => Telemetry.annotateError("api_http", error)),
          Effect.mapError(
            (error) =>
              new ConnectorError({ message: "Shopify GraphQL request failed", cause: error }),
          ),
          Effect.flatMap((response) =>
            response.json.pipe(
              Effect.tapError((error) => Telemetry.annotateError("api_json", error)),
              Effect.mapError(
                (error) =>
                  new ConnectorError({
                    message: "Shopify GraphQL returned invalid JSON",
                    cause: error,
                  }),
              ),
              Effect.map((body) => ({
                body,
                status: response.status,
              })),
            ),
          ),
        ),
      );

      if (status < 200 || status >= 300) {
        const error = { status, body, operationName: options.operationName };
        yield* Effect.logWarning("Shopify GraphQL returned non-2xx status").pipe(
          Effect.annotateLogs({
            operationName: options.operationName,
            status,
            body: summarizeBody(body),
          }),
        );
        yield* Telemetry.annotateError("api_status", error);
        return yield* Effect.fail(
          new ConnectorError({ message: "Shopify GraphQL returned non-2xx status", cause: error }),
        );
      }

      if (hasGraphqlErrors(body)) {
        yield* Effect.logWarning("Shopify GraphQL returned errors").pipe(
          Effect.annotateLogs({
            operationName: options.operationName,
            body: summarizeBody(body),
          }),
        );
        yield* Telemetry.annotateError("api_graphql", body);
        return yield* Effect.fail(
          new ConnectorError({ message: "Shopify GraphQL returned errors", cause: body }),
        );
      }

      const data =
        typeof body === "object" && body !== null ? (body as { data?: unknown }).data : undefined;
      return yield* Schema.decodeUnknownEffect(options.schema)(data).pipe(
        Effect.tapError((error) => Telemetry.annotateError("api_decode", error)),
        Effect.mapError(
          (error) =>
            new ConnectorError({
              message: "Shopify GraphQL response schema decode failed",
              cause: error,
            }),
        ),
      );
    }).pipe(
      Effect.withSpan(Telemetry.SpanName.apiFetch, {
        kind: "client",
        attributes: { [Telemetry.Attr.apiPath]: `graphql:${options.operationName}` },
      }),
    );

  const fetchProducts = (options: {
    readonly first: number;
    readonly after?: string;
  }): Effect.Effect<ShopifyProductPage, ConnectorError> =>
    fetchGraphQL({
      operationName: "AirfoilProducts",
      query: ProductsQuery,
      variables: { first: options.first, after: options.after ?? null },
      schema: GraphQLProductsDataSchema,
    }).pipe(
      Effect.flatMap((data: GraphQLProductsData) => {
        const pageInfo = data.products.pageInfo;
        if (pageInfo.hasNextPage && pageInfo.endCursor === null) {
          return Effect.fail(
            new ConnectorError({
              message: "Shopify GraphQL pageInfo.endCursor is required when hasNextPage is true",
            }),
          );
        }
        return Effect.succeed({
          items: data.products.nodes.map(normalizeProductNode),
          endCursor: pageInfo.endCursor,
          hasMore: pageInfo.hasNextPage,
        });
      }),
    );

  return { fetchGraphQL, fetchProducts };
});

export const layer = (
  config: ShopifyConfig,
): Layer.Layer<ShopifyApiClient, ConnectorError, HttpClient.HttpClient> =>
  Layer.effect(ShopifyApiClient)(make(config));

export const layerConfig = (
  config: Config.Wrap<ShopifyConfig>,
): Layer.Layer<ShopifyApiClient, ConnectorError | Config.ConfigError, HttpClient.HttpClient> =>
  Layer.effect(ShopifyApiClient)(Config.unwrap(config).pipe(Effect.flatMap(make)));
