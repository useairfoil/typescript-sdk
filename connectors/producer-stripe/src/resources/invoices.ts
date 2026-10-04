import { Resource } from "@useairfoil/connector-kit";
import { Effect } from "effect";

import type { StripeClientService } from "../client/client";

import { type InvoiceObject, InvoiceObjectSchema, InvoiceSchema } from "../schemas/invoices";
import { type StripeResourceSpec, backfillPages, checkResource, eventWebhook } from "./shared";

export const invoiceSpec: StripeResourceSpec<InvoiceObject, InvoiceObject> = {
  path: "invoices",
  objectSchema: InvoiceObjectSchema,
  toRow: Effect.succeed,
  eventTypes: [
    "invoice.created",
    "invoice.updated",
    "invoice.deleted",
    "invoice.finalized",
    "invoice.finalization_failed",
    "invoice.paid",
    "invoice.payment_succeeded",
    "invoice.payment_failed",
    "invoice.payment_action_required",
    "invoice.voided",
    "invoice.marked_uncollectible",
    "invoice.overpaid",
  ],
  deleteEventTypes: ["invoice.deleted"],
};

export const makeInvoices = (client: StripeClientService) =>
  Resource.entity({
    name: "invoices",
    rowSchema: InvoiceSchema,
    key: "id",
    version: "version",

    check: checkResource(client, invoiceSpec),
    backfill: backfillPages(client, invoiceSpec),
    webhook: eventWebhook(client, invoiceSpec),
  });
