import type { Duration, Effect, Schema } from "effect";
import type { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";

import type { ConnectorError } from "../errors";

export namespace Cursor {
  export type Value = string | number | Date;

  export type Kind = "string" | "number" | "isoDateTime";

  export type Definition<T extends Value = Value> = {
    readonly kind: Kind;
    readonly decode: (value: unknown) => Effect.Effect<T, ConnectorError>;
  };
}

export type DeleteValue = string | number | boolean | Date;

export type ResourceMutation<Row extends object = object> =
  | {
      readonly op: "upsert";
      readonly row: Row;
    }
  | {
      readonly op: "delete";
      readonly key: DeleteValue;
      readonly version: DeleteValue;
    };

export type ResourceBatch<Row extends object = object> = {
  readonly cursor?: Cursor.Value;
  readonly mutations: ReadonlyArray<ResourceMutation<Row>>;
};

export type ResourceState = {
  readonly backfill?: {
    readonly cutoff: Cursor.Value;
    readonly pageCursor?: Cursor.Value;
    readonly completed: boolean;
  };
  readonly changes?: {
    readonly cursor: Cursor.Value;
  };
};

export type ResourceSchema = Schema.Decoder<object>;

/**
 * Takes a resource schema and returns its decoded row object type.
 *
 * @example
 * ```ts
 * const ProductSchema = Schema.Struct({ id: Schema.String, updatedAt: Schema.String });
 * type Product = ResourceRow<typeof ProductSchema>;
 * // Result:
 * // type Product = { readonly id: string; readonly updatedAt: string }
 * ```
 */
export type ResourceRow<S extends ResourceSchema> = Schema.Schema.Type<S>;

/**
 * Takes a resource schema and returns the string keys available on its row type.
 *
 * @example
 * ```ts
 * const ProductSchema = Schema.Struct({ id: Schema.String, updatedAt: Schema.String });
 * type ProductField = ResourceField<typeof ProductSchema>;
 * // Result:
 * // type ProductField = "id" | "updatedAt"
 *
 * const key: ResourceField<typeof ProductSchema> = "id";
 * ```
 */
export type ResourceField<S extends ResourceSchema> = keyof ResourceRow<S> & string;

export type FetchPageResult<Row extends object> = {
  readonly mutations: ReadonlyArray<ResourceMutation<Row>>;
  readonly nextPageCursor?: Cursor.Value;
  readonly hasMore: boolean;
};

export type PageFetch<Row extends object, R = never> = {
  readonly pageCursor: Cursor.Definition;
  readonly cutoff: Cursor.Definition;
  readonly fetch: (input: {
    readonly pageCursor?: Cursor.Value;
    readonly cutoff: Cursor.Value;
  }) => Effect.Effect<FetchPageResult<Row>, ConnectorError, R>;
};

export type FetchChangesResult<Row extends object> = {
  readonly mutations: ReadonlyArray<ResourceMutation<Row>>;
  readonly cursor: Cursor.Value;
};

export type ChangesFetch<Row extends object, R = never> = {
  readonly cursor: Cursor.Definition;
  readonly interval?: Duration.Input;
  readonly fetch: (input: {
    readonly cursor: Cursor.Value;
  }) => Effect.Effect<FetchChangesResult<Row>, ConnectorError, R>;
};

export type WebhookHandler<Row extends object, Payload> = {
  readonly schema: Schema.Decoder<Payload>;
  handler(input: {
    readonly payload: Payload;
  }): Effect.Effect<ReadonlyArray<ResourceMutation<Row>>, ConnectorError>;
};

export type ResourceDefinition<
  S extends ResourceSchema = ResourceSchema,
  Payload = unknown,
  R = never,
> = {
  readonly name: string;
  readonly schema: S;
  readonly key: ResourceField<NoInfer<S>>;
  readonly version: ResourceField<NoInfer<S>>;
  readonly partition?: {
    readonly required: boolean;
  };
  readonly backfill?: PageFetch<ResourceRow<NoInfer<S>>, R>;
  readonly changes?: ChangesFetch<ResourceRow<NoInfer<S>>, R>;
  readonly webhook?: WebhookHandler<ResourceRow<NoInfer<S>>, Payload>;
};

/**
 * Takes a connector resource tuple and returns a `{ [resourceName]: rowType }`
 * map.
 *
 * @example
 * ```ts
 * type Rows = ResourceRows<[typeof Products, typeof Orders]>;
 * // Result:
 * // type Rows = {
 * //   readonly products: Product;
 * //   readonly orders: Order;
 * // }
 *
 * type ProductRow = Rows["products"];
 * // Result:
 * // type ProductRow = Product
 * ```
 */
export type ResourceRows<Resources extends ReadonlyArray<ResourceDefinition>> = {
  readonly [Resource in Resources[number] as Resource["name"]]: Resource extends ResourceDefinition<
    infer S,
    unknown,
    unknown
  >
    ? ResourceRow<S>
    : never;
};

/**
 * Takes a resource definition and returns the payload type accepted by
 * `to(resource, payload)`.
 *
 * @example
 * ```ts
 * type ProductPayload = ResourcePayload<typeof Products>;
 * // Result, if Products was defined with a ProductEvent webhook schema:
 * // type ProductPayload = ProductEvent
 * ```
 */
export type ResourcePayload<R> =
  R extends ResourceDefinition<ResourceSchema, infer Payload, unknown> ? Payload : never;

export type WebhookAckMode = "after-enqueue" | "after-publish";

export type WebhookRouteContext<
  Resources extends ReadonlyArray<ResourceDefinition> = ReadonlyArray<ResourceDefinition>,
  Payload = unknown,
> = {
  readonly request: HttpServerRequest.HttpServerRequest;
  readonly rawBody: Uint8Array;
  readonly payload: Payload;
  /** Decodes and collects mutations for a resource-owned webhook handler. */
  readonly to: <Resource extends Resources[number]>(
    resource: Resource,
    payload: ResourcePayload<Resource>,
  ) => Effect.Effect<void, ConnectorError>;
};

export type WebhookRoute<
  Resources extends ReadonlyArray<ResourceDefinition> = ReadonlyArray<ResourceDefinition>,
  Payload = unknown,
> = {
  readonly path: HttpRouter.PathInput;
  readonly ackMode: WebhookAckMode;
  readonly schema: Schema.Decoder<Payload>;
  handler(
    context: WebhookRouteContext<Resources, Payload>,
  ): Effect.Effect<HttpServerResponse.HttpServerResponse, unknown>;
};

export type WebhookRouteInput<
  Resources extends ReadonlyArray<ResourceDefinition>,
  Payload,
> = WebhookRoute<Resources, Payload>;

export type ConnectorDefinition<
  Resources extends ReadonlyArray<ResourceDefinition> = ReadonlyArray<ResourceDefinition>,
> = {
  readonly name: string;
  readonly title?: string;
  readonly resources: Resources;
  readonly webhooks?: ReadonlyArray<WebhookRoute>;
};
