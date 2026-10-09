import { Resource } from "@useairfoil/connector-kit";
import { Effect, Schema } from "effect";

import type { ZendeskClientService } from "../client/client";

import { type User, type UserObject, UserObjectSchema, UserSchema } from "../schemas/users";
import { cursorExport } from "./exports";

const UserPageSchema = Schema.Struct({
  users: Schema.Array(UserObjectSchema),
  after_cursor: Schema.NullOr(Schema.String),
  end_of_stream: Schema.Boolean,
});

// Zendesk can't restore a deleted user, so other rows leave `_deleted` out.
const toRow = ({ active, ...rest }: UserObject): User => ({
  ...rest,
  version: rest.updated_at,
  ...(active ? {} : { _deleted: true }),
});

export const makeUsers = (client: ZendeskClientService) =>
  Resource.entity({
    name: "users",
    rowSchema: UserSchema,
    key: "id",
    version: "version",
    ...cursorExport({
      client,
      path: "/incremental/users/cursor",
      schema: UserPageSchema,
      rows: (page) => Effect.succeed(page.users.map(toRow)),
    }),
  });
