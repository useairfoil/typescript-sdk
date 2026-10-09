import { Resource } from "@useairfoil/connector-kit";
import { Effect, Schema } from "effect";

import type { ZendeskClientService } from "../client/client";

import {
  type Organization,
  type OrganizationObject,
  OrganizationObjectSchema,
  OrganizationSchema,
} from "../schemas/organizations";
import { timeExport } from "./exports";

const OrganizationPageSchema = Schema.Struct({
  organizations: Schema.Array(OrganizationObjectSchema),
  end_time: Schema.NullOr(Schema.Number),
  end_of_stream: Schema.Boolean,
});

// Zendesk can't restore a deleted organization, so other rows leave
// `_deleted` out.
const toRow = ({ deleted_at, ...rest }: OrganizationObject): Organization => ({
  ...rest,
  version: rest.updated_at,
  ...(deleted_at === null ? {} : { _deleted: true }),
});

export const makeOrganizations = (client: ZendeskClientService) =>
  Resource.entity({
    name: "organizations",
    rowSchema: OrganizationSchema,
    key: "id",
    version: "version",
    ...timeExport({
      client,
      path: "/incremental/organizations",
      schema: OrganizationPageSchema,
      rows: (page) => Effect.succeed(page.organizations.map(toRow)),
    }),
  });
