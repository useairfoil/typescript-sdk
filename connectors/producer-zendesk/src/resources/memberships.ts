import { ConnectorError, Cursor, Fetch, Resource } from "@useairfoil/connector-kit";
import { DateTime, Effect, Option, Schema } from "effect";

import type { ZendeskClientService } from "../client/client";

import {
  GroupMembershipObjectSchema,
  GroupMembershipSchema,
  OrganizationMembershipObjectSchema,
  OrganizationMembershipSchema,
} from "../schemas/memberships";
import { hourly, listAll } from "./pages";

/** IDs seen by the last read. The first read has none. */
const SeenSchema = Schema.fromJsonString(Schema.Struct({ ids: Schema.Array(Schema.String) }));

type DeleteRow = { readonly id: bigint; readonly version: Date; readonly _deleted: true };

/**
 * Zendesk drops a membership from its list once it's removed. So each read
 * sends a delete for any ID the last read had and this one doesn't.
 *
 * There's no backfill. The first read runs at startup and writes every
 * membership. A separate backfill could write one that's removed before that
 * read, and it would never get its delete.
 */
const membershipSources = <Row extends { readonly id: bigint; readonly version: Date }>(
  read: Effect.Effect<ReadonlyArray<Row>, ConnectorError>,
) => ({
  check: read.pipe(Effect.asVoid),
  changes: Fetch.changes({
    cursor: Cursor.string(),
    interval: hourly,
    fetch: ({ cursor }) =>
      Effect.gen(function* () {
        const rows = yield* read;
        const now = yield* DateTime.nowAsDate;
        const seen = Schema.decodeUnknownOption(SeenSchema)(String(cursor)).pipe(
          Option.match({ onNone: () => [], onSome: ({ ids }) => ids }),
        );
        const ids = rows.map((row) => String(row.id));
        const current = new Set(ids);
        const removed = seen
          .filter((id) => !current.has(id))
          .map((id): DeleteRow => ({ id: BigInt(id), version: now, _deleted: true }));
        return {
          rows: [...rows, ...removed],
          cursor: yield* Schema.encodeEffect(SeenSchema)({ ids }).pipe(
            Effect.mapError(
              (cause) =>
                new ConnectorError({
                  message: "Could not encode Zendesk memberships cursor",
                  cause,
                }),
            ),
          ),
        };
      }),
  }),
});

export const makeGroupMemberships = (client: ZendeskClientService) =>
  Resource.entity({
    name: "group_memberships",
    rowSchema: GroupMembershipSchema,
    version: "version",
    ...membershipSources(
      listAll(client, {
        path: "/group_memberships",
        key: "group_memberships",
        item: GroupMembershipObjectSchema,
      }).pipe(
        Effect.map((memberships) =>
          memberships.map((membership) => ({ ...membership, version: membership.updated_at })),
        ),
      ),
    ),
  });

export const makeOrganizationMemberships = (client: ZendeskClientService) =>
  Resource.entity({
    name: "organization_memberships",
    rowSchema: OrganizationMembershipSchema,
    version: "version",
    ...membershipSources(
      listAll(client, {
        path: "/organization_memberships",
        key: "organization_memberships",
        item: OrganizationMembershipObjectSchema,
      }).pipe(
        Effect.map((memberships) =>
          memberships.map((membership) => ({ ...membership, version: membership.updated_at })),
        ),
      ),
    ),
  });
