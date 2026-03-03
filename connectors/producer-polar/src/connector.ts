import type { Headers, HttpClient } from "@effect/platform";
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
import { Config, Context, Effect, Layer, Option } from "effect";
import { PolarApiClient, PolarApiClientConfig } from "./api";
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
  readonly organizationId?: string;
  readonly webhookSecret?: string;
};

export type PolarConnectorRuntime = {
  readonly connector: ConnectorDefinition<PolarConfig>;
  readonly routes: ReadonlyArray<WebhookRoute<WebhookPayload>>;
};

export class PolarConnector extends Context.Tag(
  "@useairfoil/producer-polar/PolarConnector",
)<PolarConnector, PolarConnectorRuntime>() {}

const PolarConfigConfig = Config.all({
  accessToken: Config.string("POLAR_ACCESS_TOKEN"),
  apiBaseUrl: Config.string("POLAR_API_BASE_URL").pipe(
    Config.withDefault("https://sandbox-api.polar.sh/v1/"),
  ),
  organizationId: Config.option(Config.string("POLAR_ORGANIZATION_ID")),
  webhookSecret: Config.option(Config.string("POLAR_WEBHOOK_SECRET")),
});

const normalizePolarConfig = (config: {
  readonly accessToken: string;
  readonly apiBaseUrl: string;
  readonly organizationId: Option.Option<string>;
  readonly webhookSecret: Option.Option<string>;
}): PolarConfig => ({
  accessToken: config.accessToken,
  apiBaseUrl: config.apiBaseUrl,
  organizationId: Option.getOrUndefined(config.organizationId),
  webhookSecret: Option.getOrUndefined(config.webhookSecret),
});

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
      return Effect.logInfo(`[polar] webhook ${payload.type}`).pipe(
        Effect.annotateLogs({
          id: payload.data.id,
          status: payload.data.status,
        }),
        Effect.zipRight(
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
      return Effect.logInfo(`[polar] webhook ${payload.type}`).pipe(
        Effect.annotateLogs({
          id: payload.data.id,
          email: payload.data.email,
        }),
        Effect.zipRight(
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
      return Effect.logInfo(`[polar] webhook ${payload.type}`).pipe(
        Effect.annotateLogs({
          id: payload.data.id,
          status: payload.data.status,
          paid: payload.data.paid,
        }),
        Effect.zipRight(
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
      return Effect.logInfo(`[polar] webhook ${payload.type}`).pipe(
        Effect.annotateLogs({
          id: payload.data.id,
          status: payload.data.status,
        }),
        Effect.zipRight(
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

    default: {
      payload satisfies never;
      return Effect.void;
    }
  }
};

// Connector factory
const makePolarConnector = (
  config: PolarConfig,
): Effect.Effect<PolarConnectorRuntime, ConnectorError, PolarApiClient> =>
  Effect.gen(function* () {
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
      config,
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

    if (!config.webhookSecret) {
      yield* Effect.logWarning(
        "[polar] POLAR_WEBHOOK_SECRET is not set. Incoming webhooks will not be signature-verified.",
      );
    }

    return { connector, routes: [webhookRoute] };
  });

export const PolarConnectorConfig = (): Layer.Layer<
  PolarConnector,
  ConnectorError,
  HttpClient.HttpClient
> =>
  Layer.effect(
    PolarConnector,
    Effect.gen(function* () {
      const rawConfig = yield* PolarConfigConfig;
      const config = normalizePolarConfig(rawConfig);
      return yield* makePolarConnector(config).pipe(
        Effect.provide(PolarApiClientConfig(config)),
      );
    }).pipe(
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
