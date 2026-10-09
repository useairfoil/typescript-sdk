import { Connector, Cursor, Fetch } from "@useairfoil/connector-kit";
import { Config, Context, Effect, Layer, Redacted } from "effect";

import type { StripeConfig } from "./manifest";

import * as StripeClient from "./client/client";
import { chargeSpec, makeCharges } from "./resources/charges";
import { customerSpec, makeCustomers } from "./resources/customers";
import { invoiceSpec, makeInvoices } from "./resources/invoices";
import { makePrices, priceSpec } from "./resources/prices";
import { makeProducts, productSpec } from "./resources/products";
import { makeRefunds, refundSpec } from "./resources/refunds";
import { changesInterval, readEventWindow, rowsForWindow } from "./resources/shared";
import { makeSubscriptionSpec, makeSubscriptions } from "./resources/subscriptions";
import { makeWebhookRoute } from "./webhook/route";
export { manifest, StripeConfigDef } from "./manifest";
export type { StripeConfig } from "./manifest";

export const make = Effect.fnUntraced(function* (config: StripeConfig) {
  const client = yield* StripeClient.StripeClient;

  const Customers = makeCustomers(client);
  const Products = makeProducts(client);
  const Prices = makePrices(client);
  const subscriptionSpec = makeSubscriptionSpec(client);
  const Subscriptions = makeSubscriptions(client, subscriptionSpec);
  const Invoices = makeInvoices(client);
  const Charges = makeCharges(client);
  const Refunds = makeRefunds(client);

  return Connector.define({
    name: "producer-stripe",
    title: "Stripe",
    resources: [Customers, Products, Prices, Subscriptions, Invoices, Charges, Refunds],
    changes: Fetch.feed({
      resources: [Customers, Products, Prices, Subscriptions, Invoices, Charges, Refunds],
      cursor: Cursor.string(),
      interval: changesInterval,
      fetch: ({ cursor }) =>
        Effect.gen(function* () {
          const window = yield* readEventWindow(client, String(cursor));
          const rows = yield* Effect.all(
            {
              customers: rowsForWindow(client, customerSpec, window.events),
              products: rowsForWindow(client, productSpec, window.events),
              prices: rowsForWindow(client, priceSpec, window.events),
              subscriptions: rowsForWindow(client, subscriptionSpec, window.events),
              invoices: rowsForWindow(client, invoiceSpec, window.events),
              charges: rowsForWindow(client, chargeSpec, window.events),
              refunds: rowsForWindow(client, refundSpec, window.events),
            },
            { concurrency: "unbounded" },
          );
          return { rows, cursor: window.cursor, hasMore: window.hasMore };
        }),
    }),
    webhooks: [
      makeWebhookRoute({
        secret: Redacted.value(config.webhookSecret),
        targets: [
          { resource: Customers, eventTypes: customerSpec.eventTypes },
          { resource: Products, eventTypes: productSpec.eventTypes },
          { resource: Prices, eventTypes: priceSpec.eventTypes },
          { resource: Subscriptions, eventTypes: subscriptionSpec.eventTypes },
          { resource: Invoices, eventTypes: invoiceSpec.eventTypes },
          { resource: Charges, eventTypes: chargeSpec.eventTypes },
          { resource: Refunds, eventTypes: refundSpec.eventTypes },
        ],
      }),
    ],
  });
});

export type StripeConnectorRuntime = Effect.Success<ReturnType<typeof make>>;

export class StripeConnector extends Context.Service<StripeConnector, StripeConnectorRuntime>()(
  "@useairfoil/producer-stripe/StripeConnector",
) {}

export const layer = (config: StripeConfig) =>
  Layer.effect(StripeConnector)(
    make(config).pipe(Effect.annotateLogs({ component: "stripe" })),
  ).pipe(Layer.provide(StripeClient.layer(config)));

export const layerConfig = (config: Config.Wrap<StripeConfig>) =>
  Layer.unwrap(Config.unwrap(config).pipe(Effect.map(layer)));
