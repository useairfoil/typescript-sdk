import { Resource } from "@useairfoil/connector-kit";

import type { LinearClientService } from "../client/client";

import {
  CustomerNeedObjectSchema,
  CustomerNeedSchema,
  CustomerObjectSchema,
  CustomerSchema,
  CustomerStatusObjectSchema,
  CustomerStatusSchema,
  CustomerTierObjectSchema,
  CustomerTierSchema,
} from "../schemas/customers";
import {
  backfillList,
  changesList,
  checkList,
  listSources,
  listSpec,
  rowsOf,
  webhookList,
} from "./pages";

const customerSpec = listSpec({
  connection: "customers",
  single: "customer",
  fields: `id created_at: createdAt updated_at: updatedAt archived_at: archivedAt
    name domains external_ids: externalIds logo_url: logoUrl owner_id: owner { id }
    status_id: status { id } tier_id: tier { id } revenue size
    approximate_need_count: approximateNeedCount url`,
  item: CustomerObjectSchema,
  updatedAt: (customer) => customer.updated_at,
  rows: rowsOf((customer) => ({ ...customer, version: customer.updated_at, _deleted: false })),
});

export const makeCustomers = (client: LinearClientService) =>
  Resource.entity({
    name: "customers",
    rowSchema: CustomerSchema,
    version: "version",

    check: checkList(client, customerSpec),
    backfill: backfillList(client, customerSpec),
    changes: changesList(client, customerSpec),
    webhook: webhookList(client, customerSpec),
  });

const customerNeedSpec = listSpec({
  connection: "customerNeeds",
  single: "customerNeed",
  fields: `id created_at: createdAt updated_at: updatedAt archived_at: archivedAt
    customer_id: customer { id } issue_id: issue { id } project_id: project { id }
    original_issue_id: originalIssue { id } comment_id: comment { id }
    attachment_id: attachment { id } creator_id: creator { id } body priority url`,
  item: CustomerNeedObjectSchema,
  updatedAt: (need) => need.updated_at,
  rows: rowsOf((need) => ({ ...need, version: need.updated_at, _deleted: false })),
});

export const makeCustomerNeeds = (client: LinearClientService) =>
  Resource.entity({
    name: "customer_needs",
    rowSchema: CustomerNeedSchema,
    version: "version",

    check: checkList(client, customerNeedSpec),
    backfill: backfillList(client, customerNeedSpec),
    changes: changesList(client, customerNeedSpec),
    webhook: webhookList(client, customerNeedSpec),
  });

const levelFields = `id created_at: createdAt updated_at: updatedAt archived_at: archivedAt name display_name: displayName description color position`;

const customerStatusSpec = listSpec({
  connection: "customerStatuses",
  fields: levelFields,
  item: CustomerStatusObjectSchema,
  updatedAt: (status) => status.updated_at,
  rows: rowsOf((status) => ({ ...status, version: status.updated_at })),
});

export const makeCustomerStatuses = (client: LinearClientService) =>
  Resource.entity({
    name: "customer_statuses",
    rowSchema: CustomerStatusSchema,
    version: "version",
    ...listSources(client, customerStatusSpec),
  });

const customerTierSpec = listSpec({
  connection: "customerTiers",
  fields: levelFields,
  item: CustomerTierObjectSchema,
  updatedAt: (tier) => tier.updated_at,
  rows: rowsOf((tier) => ({ ...tier, version: tier.updated_at })),
});

export const makeCustomerTiers = (client: LinearClientService) =>
  Resource.entity({
    name: "customer_tiers",
    rowSchema: CustomerTierSchema,
    version: "version",
    ...listSources(client, customerTierSpec),
  });
