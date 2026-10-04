import { Resource } from "@useairfoil/connector-kit";
import { Effect } from "effect";

import type { StripeClientService } from "../client/client";

import { type CustomerObject, CustomerObjectSchema, CustomerSchema } from "../schemas/customers";
import { type StripeResourceSpec, backfillPages, checkResource, eventWebhook } from "./shared";

export const customerSpec: StripeResourceSpec<CustomerObject, CustomerObject> = {
  path: "customers",
  objectSchema: CustomerObjectSchema,
  toRow: Effect.succeed,
  eventTypes: ["customer.created", "customer.updated", "customer.deleted"],
  deleteEventTypes: ["customer.deleted"],
};

export const makeCustomers = (client: StripeClientService) =>
  Resource.entity({
    name: "customers",
    rowSchema: CustomerSchema,
    key: "id",
    version: "version",

    check: checkResource(client, customerSpec),
    backfill: backfillPages(client, customerSpec),
    webhook: eventWebhook(client, customerSpec),
  });
