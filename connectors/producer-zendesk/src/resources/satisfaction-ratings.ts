import { Cursor, Fetch, Resource } from "@useairfoil/connector-kit";
import { DateTime, Effect, Option } from "effect";

import type { ZendeskClientService } from "../client/client";

import {
  type SatisfactionRating,
  type SatisfactionRatingObject,
  SatisfactionRatingObjectSchema,
  SatisfactionRatingSchema,
} from "../schemas/satisfaction";
import { hourly, listAll, pageSize, readPage } from "./pages";

const list = {
  path: "/satisfaction_ratings",
  key: "satisfaction_ratings",
  item: SatisfactionRatingObjectSchema,
};

const toRow = (rating: SatisfactionRatingObject): SatisfactionRating => ({
  ...rating,
  version: rating.updated_at,
  reason: rating.reason ?? null,
  reason_id: rating.reason_id ?? null,
});

// A changed score is a new rating, so reading from the last run is enough.
export const makeSatisfactionRatings = (client: ZendeskClientService) =>
  Resource.entity({
    name: "satisfaction_ratings",
    rowSchema: SatisfactionRatingSchema,
    version: "version",

    check: readPage(client, { ...list, params: { "page[size]": "1" } }).pipe(Effect.asVoid),
    backfill: Fetch.page({
      pageCursor: Cursor.string(),
      cutoff: Cursor.isoDateTime(),
      fetch: ({ pageCursor }) =>
        readPage(client, list, Option.fromNullishOr(pageCursor).pipe(Option.map(String))).pipe(
          Effect.map(({ items, next }) =>
            Option.match(next, {
              onNone: () => ({ rows: items.map(toRow), hasMore: false }),
              onSome: (cursor) => ({
                rows: items.map(toRow),
                hasMore: true,
                nextPageCursor: cursor,
              }),
            }),
          ),
        ),
    }),
    changes: Fetch.changes({
      cursor: Cursor.isoDateTime(),
      interval: hourly,
      fetch: ({ cursor }) =>
        Effect.gen(function* () {
          const now = yield* DateTime.now;
          const from = DateTime.makeUnsafe(String(cursor));
          const ratings = yield* listAll(client, {
            ...list,
            params: {
              ...pageSize,
              start_time: String(Math.floor(DateTime.toEpochMillis(from) / 1000)),
            },
          });
          return { rows: ratings.map(toRow), cursor: DateTime.formatIso(now) };
        }),
    }),
  });
