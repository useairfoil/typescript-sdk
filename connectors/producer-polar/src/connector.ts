import type { Headers } from "effect/unstable/http";

import {
  Connector,
  ConnectorError,
  Cursor,
  Fetch,
  Resource,
  Webhook,
} from "@useairfoil/connector-kit";
import { Config, Context, Effect, Layer, Redacted, Schema } from "effect";
import { HttpServerResponse } from "effect/unstable/http";
import { Webhook as StandardWebhook } from "standardwebhooks";

import type { PolarConfig } from "./manifest";

import * as PolarApiClient from "./api";
import {
  CheckoutEventSchema,
  CheckoutSchema,
  CustomerEventSchema,
  CustomerSchema,
  OrderEventSchema,
  OrderSchema,
  SubscriptionEventSchema,
  SubscriptionSchema,
  WebhookPayloadSchema,
} from "./schemas";
export { manifest, PolarConfigDef } from "./manifest";
export type { PolarConfig } from "./manifest";

const verifyWebhookSignature = (options: {
  readonly rawBody: Uint8Array;
  readonly headers: Headers.Headers;
  readonly secret: string;
}): Effect.Effect<void, ConnectorError> =>
  Effect.try({
    try: () => {
      const base64Secret = Buffer.from(options.secret, "utf-8").toString("base64");
      new StandardWebhook(base64Secret).verify(Buffer.from(options.rawBody), options.headers);
    },
    catch: (error) =>
      new ConnectorError({
        message: "Invalid Polar webhook signature",
        cause: error,
      }),
  });

const withEventVersion = <Row extends { readonly version: string }>(
  row: Row,
  version: string,
): Row => ({ ...row, version });

const pageResource = <Row extends object>(options: {
  readonly api: PolarApiClient.PolarApiClientService;
  readonly schema: Schema.Decoder<Row>;
  readonly path: string;
  readonly cursorField: keyof Row & string;
  readonly limit?: number;
}) =>
  Fetch.page({
    pageCursor: Cursor.number(),
    cutoff: Cursor.isoDateTime(),
    fetch: ({ pageCursor, cutoff }) => {
      const page = typeof pageCursor === "number" ? pageCursor : 1;
      const sorting = `-${options.cursorField}`;
      return options.api
        .fetchList(options.schema, options.path, {
          page,
          limit: options.limit ?? 100,
          sorting,
        })
        .pipe(
          Effect.map((response) => ({
            mutations: response.items
              .filter(
                (row) => Date.parse(String(row[options.cursorField])) <= Date.parse(String(cutoff)),
              )
              .map(Resource.upsert),
            nextPageCursor: page < response.pagination.max_page ? page + 1 : page,
            hasMore: page < response.pagination.max_page,
          })),
        );
    },
  });

export const make = Effect.fnUntraced(function* (config: PolarConfig) {
  const api = yield* PolarApiClient.PolarApiClient;

  const Customers = Resource.entity({
    name: "customers",
    schema: CustomerSchema,
    key: "id",
    version: "version",
    check: api
      .fetchList(CustomerSchema, "customers/", { page: 1, limit: 1, sorting: "-created_at" })
      .pipe(Effect.asVoid),
    backfill: pageResource({
      api,
      schema: CustomerSchema,
      path: "customers/",
      cursorField: "created_at",
    }),
    webhook: Resource.webhook({
      schema: CustomerEventSchema,
      handler: ({ payload }) =>
        Effect.succeed([
          payload.type === "customer.deleted"
            ? Resource.delete({ key: payload.data.id, version: payload.timestamp })
            : Resource.upsert(withEventVersion(payload.data, payload.timestamp)),
        ]),
    }),
  });

  const Checkouts = Resource.entity({
    name: "checkouts",
    schema: CheckoutSchema,
    key: "id",
    version: "version",
    check: api
      .fetchList(CheckoutSchema, "checkouts/", { page: 1, limit: 1, sorting: "-created_at" })
      .pipe(Effect.asVoid),
    backfill: pageResource({
      api,
      schema: CheckoutSchema,
      path: "checkouts/",
      cursorField: "created_at",
    }),
    webhook: Resource.webhook({
      schema: CheckoutEventSchema,
      handler: ({ payload }) =>
        Effect.succeed([Resource.upsert(withEventVersion(payload.data, payload.timestamp))]),
    }),
  });

  const Orders = Resource.entity({
    name: "orders",
    schema: OrderSchema,
    key: "id",
    version: "version",
    check: api
      .fetchList(OrderSchema, "orders/", { page: 1, limit: 1, sorting: "-created_at" })
      .pipe(Effect.asVoid),
    backfill: pageResource({
      api,
      schema: OrderSchema,
      path: "orders/",
      cursorField: "created_at",
    }),
    webhook: Resource.webhook({
      schema: OrderEventSchema,
      handler: ({ payload }) =>
        Effect.succeed([Resource.upsert(withEventVersion(payload.data, payload.timestamp))]),
    }),
  });

  const Subscriptions = Resource.entity({
    name: "subscriptions",
    schema: SubscriptionSchema,
    key: "id",
    version: "version",
    check: api
      .fetchList(SubscriptionSchema, "subscriptions/", {
        page: 1,
        limit: 1,
        sorting: "-created_at",
      })
      .pipe(Effect.asVoid),
    backfill: pageResource({
      api,
      schema: SubscriptionSchema,
      path: "subscriptions/",
      cursorField: "created_at",
    }),
    webhook: Resource.webhook({
      schema: SubscriptionEventSchema,
      handler: ({ payload }) =>
        Effect.succeed([Resource.upsert(withEventVersion(payload.data, payload.timestamp))]),
    }),
  });

  const webhookRoute = Webhook.route({
    path: "/webhooks/polar",
    ackMode: "after-publish",
    schema: WebhookPayloadSchema,
    handler: ({ request, rawBody, payload, to }) =>
      Effect.gen(function* () {
        const verificationError = yield* verifyWebhookSignature({
          rawBody,
          headers: request.headers,
          secret: Redacted.value(config.webhookSecret),
        }).pipe(Effect.match({ onFailure: (error) => error, onSuccess: () => undefined }));
        if (verificationError) {
          return HttpServerResponse.jsonUnsafe(
            { ok: false, error: verificationError.message },
            { status: 401 },
          );
        }

        switch (payload.type) {
          case "customer.created":
          case "customer.updated":
          case "customer.deleted":
            yield* to(Customers, payload);
            break;
          case "checkout.created":
          case "checkout.updated":
          case "checkout.expired":
            yield* to(Checkouts, payload);
            break;
          case "order.created":
          case "order.updated":
          case "order.paid":
          case "order.refunded":
            yield* to(Orders, payload);
            break;
          case "subscription.created":
          case "subscription.updated":
          case "subscription.active":
          case "subscription.canceled":
          case "subscription.uncanceled":
          case "subscription.revoked":
          case "subscription.past_due":
          case "subscription.paused":
          case "subscription.resumed":
            yield* to(Subscriptions, payload);
            break;
          default:
            break;
        }

        return HttpServerResponse.jsonUnsafe({ ok: true });
      }),
  });

  return Connector.define({
    name: "producer-polar",
    title: "Polar",
    resources: [Customers, Checkouts, Orders, Subscriptions],
    webhooks: [webhookRoute],
  });
});

export type PolarConnectorRuntime = Effect.Success<ReturnType<typeof make>>;

export class PolarConnector extends Context.Service<PolarConnector, PolarConnectorRuntime>()(
  "@useairfoil/producer-polar/PolarConnector",
) {}

export const layer = (config: PolarConfig) =>
  Layer.effect(PolarConnector)(make(config).pipe(Effect.annotateLogs({ component: "polar" }))).pipe(
    Layer.provide(PolarApiClient.layer(config)),
  );

export const layerConfig = (config: Config.Wrap<PolarConfig>) =>
  Layer.unwrap(Config.unwrap(config).pipe(Effect.map(layer)));
