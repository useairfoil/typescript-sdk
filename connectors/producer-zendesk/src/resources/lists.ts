import { Resource } from "@useairfoil/connector-kit";
import { Effect } from "effect";

import type { ZendeskClientService } from "../client/client";

import {
  BrandObjectSchema,
  BrandSchema,
  CustomStatusObjectSchema,
  CustomStatusSchema,
  GroupObjectSchema,
  GroupSchema,
  TicketFieldObjectSchema,
  TicketFieldSchema,
  TicketFormObjectSchema,
  TicketFormSchema,
} from "../schemas/lists";
import { listAll, listSources } from "./pages";

export const makeGroups = (client: ZendeskClientService) =>
  Resource.entity({
    name: "groups",
    rowSchema: GroupSchema,
    key: "id",
    version: "version",
    ...listSources(
      listAll(client, { path: "/groups", key: "groups", item: GroupObjectSchema }).pipe(
        Effect.map((groups) => groups.map((group) => ({ ...group, version: group.updated_at }))),
      ),
    ),
  });

export const makeBrands = (client: ZendeskClientService) =>
  Resource.entity({
    name: "brands",
    rowSchema: BrandSchema,
    key: "id",
    version: "version",
    ...listSources(
      listAll(client, { path: "/brands", key: "brands", item: BrandObjectSchema }).pipe(
        Effect.map((brands) => brands.map((brand) => ({ ...brand, version: brand.updated_at }))),
      ),
    ),
  });

export const makeTicketFields = (client: ZendeskClientService) =>
  Resource.entity({
    name: "ticket_fields",
    rowSchema: TicketFieldSchema,
    key: "id",
    version: "version",
    ...listSources(
      listAll(client, {
        path: "/ticket_fields",
        key: "ticket_fields",
        item: TicketFieldObjectSchema,
      }).pipe(
        Effect.map((fields) =>
          fields.map(({ custom_field_options, ...rest }) => ({
            ...rest,
            version: rest.updated_at,
            custom_field_options: custom_field_options ?? [],
          })),
        ),
      ),
    ),
  });

export const makeTicketForms = (client: ZendeskClientService) =>
  Resource.entity({
    name: "ticket_forms",
    rowSchema: TicketFormSchema,
    key: "id",
    version: "version",
    ...listSources(
      listAll(client, {
        path: "/ticket_forms",
        key: "ticket_forms",
        item: TicketFormObjectSchema,
      }).pipe(Effect.map((forms) => forms.map((form) => ({ ...form, version: form.updated_at })))),
    ),
  });

export const makeCustomStatuses = (client: ZendeskClientService) =>
  Resource.entity({
    name: "custom_statuses",
    rowSchema: CustomStatusSchema,
    key: "id",
    version: "version",
    ...listSources(
      // It has no cursor paging and returns everything at once.
      listAll(client, {
        path: "/custom_statuses",
        key: "custom_statuses",
        item: CustomStatusObjectSchema,
        params: {},
      }).pipe(
        Effect.map((statuses) =>
          statuses.map((status) => ({ ...status, version: status.updated_at })),
        ),
      ),
    ),
  });
