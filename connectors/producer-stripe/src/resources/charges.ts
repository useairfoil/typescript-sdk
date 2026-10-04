import { Resource } from "@useairfoil/connector-kit";
import { Effect } from "effect";

import type { StripeClientService } from "../client/client";

import { type ChargeObject, ChargeObjectSchema, ChargeSchema } from "../schemas/charges";
import { type StripeResourceSpec, backfillPages, checkResource, eventWebhook } from "./shared";

export const chargeSpec: StripeResourceSpec<ChargeObject, ChargeObject> = {
  path: "charges",
  objectSchema: ChargeObjectSchema,
  toRow: Effect.succeed,
  eventTypes: [
    "charge.succeeded",
    "charge.failed",
    "charge.pending",
    "charge.captured",
    "charge.expired",
    "charge.refunded",
    "charge.updated",
  ],
  deleteEventTypes: [],
};

export const makeCharges = (client: StripeClientService) =>
  Resource.entity({
    name: "charges",
    rowSchema: ChargeSchema,
    key: "id",
    version: "version",

    check: checkResource(client, chargeSpec),
    backfill: backfillPages(client, chargeSpec),
    webhook: eventWebhook(client, chargeSpec),
  });
