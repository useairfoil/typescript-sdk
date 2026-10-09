import { Resource } from "@useairfoil/connector-kit";
import { Effect } from "effect";

import type { StripeClientService } from "../client/client";

import {
  type SubscriptionObject,
  SubscriptionItemSchema,
  SubscriptionObjectSchema,
  type SubscriptionRow,
  SubscriptionSchema,
} from "../schemas/subscriptions";
import {
  type StripeResourceSpec,
  backfillPages,
  checkResource,
  eventWebhook,
  listAll,
} from "./shared";

export const subscriptionEventTypes = [
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
  "customer.subscription.pending_update_applied",
  "customer.subscription.pending_update_expired",
] as const;

export const makeSubscriptionSpec = (
  client: StripeClientService,
): StripeResourceSpec<SubscriptionObject, SubscriptionRow> => ({
  path: "subscriptions",
  objectSchema: SubscriptionObjectSchema,
  // Stripe embeds only the first page of items. A partial list would understate MRR.
  toRow: (subscription) =>
    (subscription.items.has_more
      ? listAll(client, SubscriptionItemSchema, "subscription_items", [
          ["subscription", subscription.id],
        ])
      : Effect.succeed(subscription.items.data)
    ).pipe(Effect.map((items) => ({ ...subscription, items }))),
  // Without this, the list leaves out canceled subscriptions.
  listParams: [["status", "all"]],
  eventTypes: subscriptionEventTypes,
  // customer.subscription.deleted means canceled, so the subscription is fetched and kept.
  deleteEventTypes: [],
});

export const makeSubscriptions = (
  client: StripeClientService,
  spec: StripeResourceSpec<SubscriptionObject, SubscriptionRow>,
) =>
  Resource.entity({
    name: "subscriptions",
    rowSchema: SubscriptionSchema,
    key: "id",
    version: "version",

    check: checkResource(client, spec),
    backfill: backfillPages(client, spec),
    webhook: eventWebhook(client, spec),
  });
