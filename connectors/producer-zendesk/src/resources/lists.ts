import { Resource } from "@useairfoil/connector-kit";
import { DateTime, Effect } from "effect";

import type { ZendeskClientService } from "../client/client";

import {
  BrandObjectSchema,
  BrandSchema,
  CustomRoleObjectSchema,
  CustomRoleSchema,
  CustomStatusObjectSchema,
  CustomStatusSchema,
  GroupObjectSchema,
  GroupSchema,
  HolidaySchema,
  MacroObjectSchema,
  MacroSchema,
  OrganizationFieldObjectSchema,
  OrganizationFieldSchema,
  ScheduleObjectSchema,
  ScheduleSchema,
  SlaPolicyObjectSchema,
  SlaPolicySchema,
  TicketFieldObjectSchema,
  TicketFieldSchema,
  TicketFormObjectSchema,
  TicketFormSchema,
  UserFieldObjectSchema,
  UserFieldSchema,
} from "../schemas/lists";
import { listAll, listSources } from "./pages";

export const makeGroups = (client: ZendeskClientService) =>
  Resource.entity({
    name: "groups",
    rowSchema: GroupSchema,
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

export const makeUserFields = (client: ZendeskClientService) =>
  Resource.entity({
    name: "user_fields",
    rowSchema: UserFieldSchema,
    version: "version",
    ...listSources(
      listAll(client, {
        path: "/user_fields",
        key: "user_fields",
        item: UserFieldObjectSchema,
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

export const makeOrganizationFields = (client: ZendeskClientService) =>
  Resource.entity({
    name: "organization_fields",
    rowSchema: OrganizationFieldSchema,
    version: "version",
    ...listSources(
      listAll(client, {
        path: "/organization_fields",
        key: "organization_fields",
        item: OrganizationFieldObjectSchema,
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

export const makeSlaPolicies = (client: ZendeskClientService) =>
  Resource.entity({
    name: "sla_policies",
    rowSchema: SlaPolicySchema,
    version: "version",
    ...listSources(
      // It has no cursor paging and returns everything at once.
      listAll(client, {
        path: "/slas/policies",
        key: "sla_policies",
        item: SlaPolicyObjectSchema,
        params: {},
      }).pipe(
        Effect.map((policies) =>
          policies.map((policy) => ({ ...policy, version: policy.updated_at })),
        ),
      ),
    ),
  });

export const makeSchedules = (client: ZendeskClientService) =>
  Resource.entity({
    name: "schedules",
    rowSchema: ScheduleSchema,
    version: "version",
    ...listSources(
      Effect.gen(function* () {
        const schedules = yield* listAll(client, {
          path: "/business_hours/schedules",
          key: "schedules",
          item: ScheduleObjectSchema,
          params: {},
        });
        const version = yield* DateTime.nowAsDate;
        // Accounts have a few schedules, so read each one's holidays.
        return yield* Effect.forEach(schedules, (schedule) =>
          listAll(client, {
            path: `/business_hours/schedules/${schedule.id}/holidays`,
            key: "holidays",
            item: HolidaySchema,
            params: {},
          }).pipe(Effect.map((holidays) => ({ ...schedule, version, holidays }))),
        );
      }),
    ),
  });

export const makeCustomRoles = (client: ZendeskClientService) =>
  Resource.entity({
    name: "custom_roles",
    rowSchema: CustomRoleSchema,
    version: "version",
    ...listSources(
      // It has no cursor paging and returns everything at once.
      listAll(client, {
        path: "/custom_roles",
        key: "custom_roles",
        item: CustomRoleObjectSchema,
        params: {},
      }).pipe(Effect.map((roles) => roles.map((role) => ({ ...role, version: role.updated_at })))),
    ),
  });

export const makeMacros = (client: ZendeskClientService) =>
  Resource.entity({
    name: "macros",
    rowSchema: MacroSchema,
    version: "version",
    ...listSources(
      listAll(client, { path: "/macros", key: "macros", item: MacroObjectSchema }).pipe(
        Effect.map((macros) => macros.map((macro) => ({ ...macro, version: macro.updated_at }))),
      ),
    ),
  });
