import type { Headers, HttpClient } from "effect/unstable/http";

import { validateEvent, WebhookVerificationError } from "@polar-sh/sdk/webhooks";
import {
  type ConnectorDefinition,
  ConnectorError,
  defineConnector,
  defineEntity,
  Webhook,
} from "@useairfoil/connector-kit";
import { Config, Context, Effect, Layer, Option } from "effect";

import { layerApiClient, PolarApiClient } from "./api";
import {
  type Checkout,
  CheckoutSchema,
  type Customer,
  CustomerSchema,
  type Order,
  OrderSchema,
  type Subscription,
  SubscriptionSchema,
  type WebhookPayload,
  WebhookPayloadSchema,
} from "./schemas";
import {
  dispatchEntityWebhook,
  type EntityStreams,
  makeEntityStreams,
  resolveCursor,
} from "./streams";

export type PolarConfig = {
  readonly accessToken: string;
  readonly apiBaseUrl: string;
  readonly organizationId: Option.Option<string>;
  readonly webhookSecret: Option.Option<string>;
};

export type PolarConnectorRuntime = {
  readonly connector: ConnectorDefinition;
  readonly routes: ReadonlyArray<Webhook.WebhookRoute<typeof WebhookPayloadSchema>>;
};

export class PolarConnector extends Context.Service<PolarConnector, PolarConnectorRuntime>()(
  "@useairfoil/producer-polar/PolarConnector",
) {}

export const PolarConfigConfig = Config.all({
  accessToken: Config.string("POLAR_ACCESS_TOKEN"),
  apiBaseUrl: Config.string("POLAR_API_BASE_URL").pipe(
    Config.withDefault("https://sandbox-api.polar.sh/v1/"),
  ),
  organizationId: Config.option(Config.string("POLAR_ORGANIZATION_ID")),
  webhookSecret: Config.option(Config.string("POLAR_WEBHOOK_SECRET")),
});

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

const resolveWebhookDispatch = (options: {
  readonly payload: WebhookPayload;
  readonly customers: EntityStreams<Customer>;
  readonly checkouts: EntityStreams<Checkout>;
  readonly subscriptions: EntityStreams<Subscription>;
  readonly orders: EntityStreams<Order>;
}) => {
  const { payload } = options;
  const payloadType = payload.type;

  switch (payload.type) {
    case "checkout.created":
    case "checkout.updated":
    case "checkout.expired": {
      return Effect.logInfo(`webhook ${payload.type}`).pipe(
        Effect.annotateLogs({
          id: payload.data.id,
          status: payload.data.status,
        }),
        Effect.andThen(
          resolveCursor(payload.data, "created_at").pipe(
            Effect.flatMap((cursor) =>
              dispatchEntityWebhook({
                queue: options.checkouts.live,
                cutoff: options.checkouts.cutoff,
                row: payload.data,
                cursor,
              }),
            ),
          ),
        ),
      );
    }

    case "customer.created":
    case "customer.updated":
    case "customer.deleted": {
      return Effect.logInfo(`webhook ${payload.type}`).pipe(
        Effect.annotateLogs({ id: payload.data.id, email: payload.data.email }),
        Effect.andThen(
          resolveCursor(payload.data, "created_at").pipe(
            Effect.flatMap((cursor) =>
              dispatchEntityWebhook({
                queue: options.customers.live,
                cutoff: options.customers.cutoff,
                row: payload.data,
                cursor,
              }),
            ),
          ),
        ),
      );
    }

    case "order.created":
    case "order.updated":
    case "order.paid":
    case "order.refunded": {
      return Effect.logInfo(`webhook ${payload.type}`).pipe(
        Effect.annotateLogs({
          id: payload.data.id,
          status: payload.data.status,
          paid: payload.data.paid,
        }),
        Effect.andThen(
          resolveCursor(payload.data, "created_at").pipe(
            Effect.flatMap((cursor) =>
              dispatchEntityWebhook({
                queue: options.orders.live,
                cutoff: options.orders.cutoff,
                row: payload.data,
                cursor,
              }),
            ),
          ),
        ),
      );
    }

    case "subscription.created":
    case "subscription.updated":
    case "subscription.active":
    case "subscription.canceled":
    case "subscription.uncanceled":
    case "subscription.revoked":
    case "subscription.past_due": {
      return Effect.logInfo(`webhook ${payload.type}`).pipe(
        Effect.annotateLogs({
          id: payload.data.id,
          status: payload.data.status,
        }),
        Effect.andThen(
          resolveCursor(payload.data, "created_at").pipe(
            Effect.flatMap((cursor) =>
              dispatchEntityWebhook({
                queue: options.subscriptions.live,
                cutoff: options.subscriptions.cutoff,
                row: payload.data,
                cursor,
              }),
            ),
          ),
        ),
      );
    }
    // ignored events
    case "customer.state_changed":
    case "customer_seat.assigned":
    case "customer_seat.claimed":
    case "customer_seat.revoked":
    case "member.created":
    case "member.updated":
    case "member.deleted":
    case "refund.created":
    case "refund.updated":
    case "product.created":
    case "product.updated":
    case "benefit.created":
    case "benefit.updated":
    case "benefit_grant.created":
    case "benefit_grant.cycled":
    case "benefit_grant.updated":
    case "benefit_grant.revoked":
    case "organization.updated": {
      return Effect.void;
    }

    default: {
      return Effect.logWarning("Ignoring unknown webhook type").pipe(
        Effect.annotateLogs({ type: payloadType }),
        Effect.asVoid,
      );
    }
  }
};

// Connector factory
const makePolarConnector = (
  config: PolarConfig,
): Effect.Effect<PolarConnectorRuntime, ConnectorError, PolarApiClient> =>
  Effect.fnUntraced(function* () {
    const api = yield* PolarApiClient;
    const customerStreams = yield* makeEntityStreams({
      api,
      schema: CustomerSchema,
      path: "customers/",
      cursorField: "created_at",
    });

    const checkoutStreams = yield* makeEntityStreams({
      api,
      schema: CheckoutSchema,
      path: "checkouts/",
      cursorField: "created_at",
    });

    const subscriptionStreams = yield* makeEntityStreams({
      api,
      schema: SubscriptionSchema,
      path: "subscriptions/",
      cursorField: "created_at",
    });

    const orderStreams = yield* makeEntityStreams({
      api,
      schema: OrderSchema,
      path: "orders/",
      cursorField: "created_at",
    });

    const connector = defineConnector({
      name: "producer-polar",
      entities: [
        defineEntity({
          name: "customers",
          schema: CustomerSchema,
          primaryKey: "id",
          live: customerStreams.live,
          backfill: customerStreams.backfill,
        }),
        defineEntity({
          name: "checkouts",
          schema: CheckoutSchema,
          primaryKey: "id",
          live: checkoutStreams.live,
          backfill: checkoutStreams.backfill,
        }),
        defineEntity({
          name: "subscriptions",
          schema: SubscriptionSchema,
          primaryKey: "id",
          live: subscriptionStreams.live,
          backfill: subscriptionStreams.backfill,
        }),
        defineEntity({
          name: "orders",
          schema: OrderSchema,
          primaryKey: "id",
          live: orderStreams.live,
          backfill: orderStreams.backfill,
        }),
      ],
      events: [],
    });

    const webhookRoute = Webhook.route({
      path: "/webhooks/polar",
      schema: WebhookPayloadSchema,
      handle: (payload, request, rawBody) =>
        Effect.fn("polar/webhook/handle")(function* () {
          if (Option.isSome(config.webhookSecret) && rawBody) {
            yield* verifyWebhookSignature({
              rawBody,
              headers: request.headers,
              secret: config.webhookSecret.value,
            });
          }

          return yield* resolveWebhookDispatch({
            payload,
            customers: customerStreams,
            checkouts: checkoutStreams,
            subscriptions: subscriptionStreams,
            orders: orderStreams,
          });
        })(),
    });

    if (Option.isNone(config.webhookSecret)) {
      yield* Effect.logWarning(
        "POLAR_WEBHOOK_SECRET is not set. Incoming webhooks will not be signature-verified.",
      );
    }

    return { connector, routes: [webhookRoute] };
  })().pipe(Effect.annotateLogs({ component: "polar" }));

export const layerConfig: Layer.Layer<PolarConnector, ConnectorError, HttpClient.HttpClient> =
  Layer.effect(PolarConnector)(
    Effect.fnUntraced(function* () {
      const config = yield* PolarConfigConfig;
      return yield* makePolarConnector(config).pipe(Effect.provide(layerApiClient(config)));
    })().pipe(
      Effect.mapError((error) =>
        error instanceof ConnectorError
          ? error
          : new ConnectorError({
              message: "Polar config failed",
              cause: error,
            }),
      ),
    ),
  );
