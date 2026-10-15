import { Resource } from "@useairfoil/connector-kit";
import { Array as Arr, Effect, Schema, Struct } from "effect";

import type { ZendeskClientService } from "../client/client";

import {
  type IdentityObject,
  IdentityObjectSchema,
  type User,
  type UserObject,
  UserObjectSchema,
  UserSchema,
} from "../schemas/users";
import { cursorExport } from "./exports";

const UserPageSchema = Schema.Struct({
  users: Schema.Array(UserObjectSchema),
  identities: Schema.Array(IdentityObjectSchema),
  after_cursor: Schema.NullOr(Schema.String),
  end_of_stream: Schema.Boolean,
});

// Zendesk can't restore a deleted user, so other rows leave `_deleted` out.
const toRow =
  (identities: Readonly<Record<string, ReadonlyArray<IdentityObject>>>) =>
  ({ active, ...rest }: UserObject): User => ({
    ...rest,
    version: rest.updated_at,
    identities: (identities[String(rest.id)] ?? []).map((identity) =>
      Struct.omit(identity, ["user_id"]),
    ),
    ...(active ? {} : { _deleted: true }),
  });

export const makeUsers = (client: ZendeskClientService) =>
  Resource.entity({
    name: "users",
    rowSchema: UserSchema,
    version: "version",
    ...cursorExport({
      client,
      path: "/incremental/users/cursor",
      schema: UserPageSchema,
      params: { include: "identities" },
      rows: (page) =>
        Effect.succeed(
          page.users.map(
            toRow(Arr.groupBy(page.identities, (identity) => String(identity.user_id))),
          ),
        ),
    }),
  });
