import type { Headers } from "@effect/platform";
import {
  validateEvent,
  WebhookVerificationError,
} from "@polar-sh/sdk/webhooks";
import {
  type ConnectorDefinition,
  ConnectorError,
  defineConnector,
  defineEntity,
  type WebhookRoute,
} from "@useairfoil/connector-kit";
import type { VcrConfig } from "@useairfoil/connector-kit/vcr";
import { Effect } from "effect";
import { makePolarApiClient, type PolarApiClient } from "./api";
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
  readonly organizationId?: string;
  readonly webhookSecret?: string;
};

export type PolarConnectorRuntime = {
  readonly connector: ConnectorDefinition<PolarConfig>;
  readonly routes: ReadonlyArray<WebhookRoute<WebhookPayload>>;
};

export type PolarConnectorOptions = {
  readonly api?: PolarApiClient;
  readonly vcr?: VcrConfig;
};

// Webhook verification
const verifyWebhookSignature = (options: {
  readonly rawBody: Uint8Array;
  readonly headers: Headers.Headers;
  readonly secret: string;
}): Effect.Effect<void, ConnectorError> =>
  Effect.try({
    try: () => {
      validateEvent(
        Buffer.from(options.rawBody),
        options.headers,
        options.secret,
      );
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

// Webhook dispatch
const resolveWebhookDispatch = (options: {
  readonly payload: WebhookPayload;
  readonly customers: EntityStreams<Customer>;
  readonly checkouts: EntityStreams<Checkout>;
  readonly subscriptions: EntityStreams<Subscription>;
  readonly orders: EntityStreams<Order>;
}) => {
  const { payload } = options;

  switch (payload.type) {
    case "checkout.created":
    case "checkout.updated":
    case "checkout.expired": {
      console.log(`[polar] webhook ${payload.type}`, {
        id: payload.data.id,
        status: payload.data.status,
      });
      return dispatchEntityWebhook({
        queue: options.checkouts.queue,
        cutoff: options.checkouts.cutoff,
        row: payload.data,
        cursor: resolveCursor(payload.data, "created_at"),
      });
    }

    case "customer.created":
    case "customer.updated":
    case "customer.deleted": {
      console.log(`[polar] webhook ${payload.type}`, {
        id: payload.data.id,
        email: payload.data.email,
      });
      return dispatchEntityWebhook({
        queue: options.customers.queue,
        cutoff: options.customers.cutoff,
        row: payload.data,
        cursor: resolveCursor(payload.data, "created_at"),
      });
    }

    case "order.created":
    case "order.updated":
    case "order.paid":
    case "order.refunded": {
      console.log(`[polar] webhook ${payload.type}`, {
        id: payload.data.id,
        status: payload.data.status,
        paid: payload.data.paid,
      });
      return dispatchEntityWebhook({
        queue: options.orders.queue,
        cutoff: options.orders.cutoff,
        row: payload.data,
        cursor: resolveCursor(payload.data, "created_at"),
      });
    }

    case "subscription.created":
    case "subscription.updated":
    case "subscription.active":
    case "subscription.canceled":
    case "subscription.uncanceled":
    case "subscription.revoked":
    case "subscription.past_due": {
      console.log(`[polar] webhook ${payload.type}`, {
        id: payload.data.id,
        status: payload.data.status,
      });
      return dispatchEntityWebhook({
        queue: options.subscriptions.queue,
        cutoff: options.subscriptions.cutoff,
        row: payload.data,
        cursor: resolveCursor(payload.data, "started_at"),
      });
    }

    default: {
      payload satisfies never;
      return Effect.void;
    }
  }
};

// Connector factory
export const makePolarConnector = (
  config: PolarConfig,
  options: PolarConnectorOptions = {},
): Effect.Effect<PolarConnectorRuntime, ConnectorError> =>
  Effect.gen(function* () {
    const api = options.api ?? (yield* makePolarApiClient(config, options));
    const customerStreams = yield* makeEntityStreams<Customer>({
      api,
      path: "customers/",
      cursorField: "created_at",
    });

    const checkoutStreams = yield* makeEntityStreams<Checkout>({
      api,
      path: "checkouts/",
      cursorField: "created_at",
    });

    const subscriptionStreams = yield* makeEntityStreams<Subscription>({
      api,
      path: "subscriptions/",
      cursorField: "started_at",
    });

    const orderStreams = yield* makeEntityStreams<Order>({
      api,
      path: "orders/",
      cursorField: "created_at",
    });

    const connector = defineConnector({
      name: "producer-polar",
      config,
      entities: [
        defineEntity<Customer>({
          name: "customers",
          schema: CustomerSchema,
          primaryKey: "id",
          live: customerStreams.queue,
          backfill: customerStreams.backfill,
        }),
        defineEntity<Checkout>({
          name: "checkouts",
          schema: CheckoutSchema,
          primaryKey: "id",
          live: checkoutStreams.queue,
          backfill: checkoutStreams.backfill,
        }),
        defineEntity<Subscription>({
          name: "subscriptions",
          schema: SubscriptionSchema,
          primaryKey: "id",
          live: subscriptionStreams.queue,
          backfill: subscriptionStreams.backfill,
        }),
        defineEntity<Order>({
          name: "orders",
          schema: OrderSchema,
          primaryKey: "id",
          live: orderStreams.queue,
          backfill: orderStreams.backfill,
        }),
      ],
      events: [],
    });

    const webhookRoute: WebhookRoute<WebhookPayload> = {
      path: "/webhooks/polar",
      schema: WebhookPayloadSchema,
      handle: (payload, request, rawBody) =>
        Effect.gen(function* () {
          if (config.webhookSecret && rawBody) {
            yield* verifyWebhookSignature({
              rawBody,
              headers: request.headers,
              secret: config.webhookSecret,
            });
          }

          yield* resolveWebhookDispatch({
            payload,
            customers: customerStreams,
            checkouts: checkoutStreams,
            subscriptions: subscriptionStreams,
            orders: orderStreams,
          });
        }),
    };

    return { connector, routes: [webhookRoute] };
  });
