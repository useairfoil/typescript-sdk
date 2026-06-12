import type { Headers, HttpClient } from "effect/unstable/http";

import { validateEvent, WebhookVerificationError } from "@polar-sh/sdk/webhooks";
import {
  Connector,
  type ConnectorDefinition,
  ConnectorError,
  Cursor,
  Fetch,
  Resource,
  Webhook,
} from "@useairfoil/connector-kit";
import { Config, Context, Effect, Layer, Option, Schema } from "effect";
import { HttpServerResponse } from "effect/unstable/http";

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

export type PolarConfig = {
  readonly accessToken: string;
  readonly apiBaseUrl: string;
  readonly organizationId: Option.Option<string>;
  readonly webhookSecret: Option.Option<string>;
};

export type PolarConnectorRuntime = ConnectorDefinition;

export class PolarConnector extends Context.Service<PolarConnector, PolarConnectorRuntime>()(
  "@useairfoil/producer-polar/PolarConnector",
) {}

export const PolarConfigFields = {
  accessToken: Config.string("POLAR_ACCESS_TOKEN"),
  apiBaseUrl: Config.string("POLAR_API_BASE_URL"),
  organizationId: Config.option(Config.string("POLAR_ORGANIZATION_ID")),
  webhookSecret: Config.option(Config.string("POLAR_WEBHOOK_SECRET")),
} as const;

export const PolarConfigConfig = Config.all(PolarConfigFields);

const verifyWebhookSignature = (options: {
  readonly rawBody: Uint8Array;
  readonly headers: Headers.Headers;
  readonly secret: string;
}): Effect.Effect<void, ConnectorError> =>
  Effect.try({
    try: () => {
      validateEvent(Buffer.from(options.rawBody), options.headers, options.secret);
    },
    catch: (error) =>
      new ConnectorError({
        message:
          error instanceof WebhookVerificationError
            ? "Invalid Polar webhook signature"
            : "Failed to validate Polar webhook",
        cause: error,
      }),
  });

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
    version: "created_at",
    backfill: pageResource({
      api,
      schema: CustomerSchema,
      path: "customers/",
      cursorField: "created_at",
    }),
    webhook: Resource.webhook({
      schema: CustomerEventSchema,
      handler: ({ payload }) => Effect.succeed([Resource.upsert(payload.data)]),
    }),
  });

  const Checkouts = Resource.entity({
    name: "checkouts",
    schema: CheckoutSchema,
    key: "id",
    version: "created_at",
    backfill: pageResource({
      api,
      schema: CheckoutSchema,
      path: "checkouts/",
      cursorField: "created_at",
    }),
    webhook: Resource.webhook({
      schema: CheckoutEventSchema,
      handler: ({ payload }) => Effect.succeed([Resource.upsert(payload.data)]),
    }),
  });

  const Orders = Resource.entity({
    name: "orders",
    schema: OrderSchema,
    key: "id",
    version: "created_at",
    backfill: pageResource({
      api,
      schema: OrderSchema,
      path: "orders/",
      cursorField: "created_at",
    }),
    webhook: Resource.webhook({
      schema: OrderEventSchema,
      handler: ({ payload }) => Effect.succeed([Resource.upsert(payload.data)]),
    }),
  });

  const Subscriptions = Resource.entity({
    name: "subscriptions",
    schema: SubscriptionSchema,
    key: "id",
    version: "created_at",
    backfill: pageResource({
      api,
      schema: SubscriptionSchema,
      path: "subscriptions/",
      cursorField: "created_at",
    }),
    webhook: Resource.webhook({
      schema: SubscriptionEventSchema,
      handler: ({ payload }) => Effect.succeed([Resource.upsert(payload.data)]),
    }),
  });

  const webhookRoute = Webhook.route({
    path: "/webhooks/polar",
    ackMode: "after-publish",
    schema: WebhookPayloadSchema,
    handler: ({ request, rawBody, payload, to }) =>
      Effect.gen(function* () {
        if (Option.isSome(config.webhookSecret)) {
          const verificationError = yield* verifyWebhookSignature({
            rawBody,
            headers: request.headers,
            secret: config.webhookSecret.value,
          }).pipe(Effect.match({ onFailure: (error) => error, onSuccess: () => undefined }));
          if (verificationError) {
            return HttpServerResponse.jsonUnsafe(
              { ok: false, error: verificationError.message },
              { status: 401 },
            );
          }
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
            yield* to(Subscriptions, payload);
            break;
          default:
            break;
        }

        return HttpServerResponse.jsonUnsafe({ ok: true });
      }),
  });

  if (Option.isNone(config.webhookSecret)) {
    yield* Effect.logWarning(
      "POLAR_WEBHOOK_SECRET is not set. Incoming webhooks will not be signature-verified.",
    );
  }

  return Connector.define({
    name: "producer-polar",
    title: "Polar",
    resources: [Customers, Checkouts, Orders, Subscriptions],
    webhooks: [webhookRoute],
  });
});

export const layer = (
  config: PolarConfig,
): Layer.Layer<PolarConnector, ConnectorError, HttpClient.HttpClient> =>
  Layer.effect(PolarConnector)(
    make(config).pipe(
      Effect.annotateLogs({ component: "polar" }),
      Effect.provide(PolarApiClient.layer(config)),
    ),
  );

export const layerConfig = (
  config: Config.Wrap<PolarConfig>,
): Layer.Layer<PolarConnector, ConnectorError | Config.ConfigError, HttpClient.HttpClient> =>
  Layer.effect(PolarConnector)(
    Config.unwrap(config)
      .asEffect()
      .pipe(
        Effect.flatMap((config) =>
          make(config).pipe(
            Effect.annotateLogs({ component: "polar" }),
            Effect.provide(PolarApiClient.layer(config)),
          ),
        ),
      ),
  );
