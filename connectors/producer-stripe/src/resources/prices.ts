import { Resource } from "@useairfoil/connector-kit";
import { Effect } from "effect";

import type { StripeClientService } from "../client/client";

import { type PriceObject, PriceObjectSchema, PriceSchema } from "../schemas/prices";
import { type StripeResourceSpec, backfillPages, checkResource, eventWebhook } from "./shared";

export const priceSpec: StripeResourceSpec<PriceObject, PriceObject> = {
  path: "prices",
  objectSchema: PriceObjectSchema,
  toRow: Effect.succeed,
  eventTypes: ["price.created", "price.updated", "price.deleted"],
  deleteEventTypes: ["price.deleted"],
};

export const makePrices = (client: StripeClientService) =>
  Resource.entity({
    name: "prices",
    rowSchema: PriceSchema,
    key: "id",
    version: "version",

    check: checkResource(client, priceSpec),
    backfill: backfillPages(client, priceSpec),
    webhook: eventWebhook(client, priceSpec),
  });
