import { type ConnectorError, Cursor, Fetch, Resource } from "@useairfoil/connector-kit";
import { DateTime, Duration, Effect, Option, Stream } from "effect";

import { HUBSPOT_API_VERSION, type HubSpotClientService } from "../client/client";
import { listPage } from "../schemas/api";
import { type Owner, type OwnerObject, OwnerObjectSchema, OwnerSchema } from "../schemas/owners";

const ownersPath = `/crm/owners/${HUBSPOT_API_VERSION}`;
const OwnerPageSchema = listPage(OwnerObjectSchema);
// Owners are few and have no updated-since filter, so changes read them all.
const changesInterval = Duration.hours(1);

// Rows use the fetch time, so each hourly read replaces them.
const toRow = (owner: OwnerObject, fetchedAt: Date): Owner => ({
  id: owner.id,
  version: fetchedAt,
  type: owner.type,
  email: owner.email,
  first_name: owner.firstName,
  last_name: owner.lastName,
  user_id: owner.userId,
  user_id_including_inactive: owner.userIdIncludingInactive,
  teams: owner.teams ?? [],
  archived: owner.archived,
  created_at: owner.createdAt,
});

const listOwners = (
  client: HubSpotClientService,
  archived: boolean,
): Effect.Effect<ReadonlyArray<Owner>, ConnectorError> =>
  Stream.paginate(Option.none<string>(), (after) =>
    client
      .get(OwnerPageSchema, ownersPath, {
        limit: "100",
        archived: String(archived),
        ...Option.match(after, { onNone: () => ({}), onSome: (value) => ({ after: value }) }),
      })
      .pipe(
        Effect.map(({ body, fetchedAt }) => {
          const next = Option.fromNullishOr(body.paging?.next.after);
          return [
            body.results.map((owner) => toRow(owner, fetchedAt)),
            Option.map(next, Option.some),
          ] as const;
        }),
      ),
  ).pipe(Stream.runCollect);

const listAll = (client: HubSpotClientService) =>
  Effect.all([listOwners(client, false), listOwners(client, true)]).pipe(
    Effect.map(([active, archived]) => [...active, ...archived]),
  );

export const makeOwners = (client: HubSpotClientService) =>
  Resource.entity({
    name: "owners",
    rowSchema: OwnerSchema,
    key: "id",
    version: "version",

    check: client.get(OwnerPageSchema, ownersPath, { limit: "1" }).pipe(Effect.asVoid),
    backfill: Fetch.page({
      pageCursor: Cursor.string(),
      cutoff: Cursor.isoDateTime(),
      fetch: () => listAll(client).pipe(Effect.map((rows) => ({ rows, hasMore: false }))),
    }),
    changes: Fetch.changes({
      cursor: Cursor.string(),
      interval: changesInterval,
      fetch: () =>
        Effect.all([listAll(client), DateTime.now]).pipe(
          Effect.map(([rows, now]) => ({ rows, cursor: DateTime.formatIso(now) })),
        ),
    }),
  });
