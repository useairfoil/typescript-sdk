import { Resource } from "@useairfoil/connector-kit";
import { Effect } from "effect";

import type { StripeClientService } from "../client/client";

import { type ProductObject, ProductObjectSchema, ProductSchema } from "../schemas/products";
import { type StripeResourceSpec, backfillPages, checkResource, eventWebhook } from "./shared";

export const productSpec: StripeResourceSpec<ProductObject, ProductObject> = {
  path: "products",
  objectSchema: ProductObjectSchema,
  toRow: Effect.succeed,
  eventTypes: ["product.created", "product.updated", "product.deleted"],
  deleteEventTypes: ["product.deleted"],
};

export const makeProducts = (client: StripeClientService) =>
  Resource.entity({
    name: "products",
    rowSchema: ProductSchema,
    key: "id",
    version: "version",

    check: checkResource(client, productSpec),
    backfill: backfillPages(client, productSpec),
    webhook: eventWebhook(client, productSpec),
  });
