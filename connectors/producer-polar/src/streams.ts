import type * as Schema from "effect/Schema";

import {
  type Batch,
  type ConnectorError,
  type Cursor,
  makePullStream,
  makeWebhookQueue,
  type WebhookStream,
} from "@useairfoil/connector-kit";
import { DateTime, Deferred, Effect, Queue, Stream } from "effect";

import type { PolarApiClientService } from "./api";

// Cursor helpers
const toDate = (cursor: Cursor) => (cursor instanceof Date ? cursor : new Date(String(cursor)));

export const resolveCursor = <T extends Record<string, unknown>>(
  row: T,
  cursorField: keyof T & string,
): Effect.Effect<Cursor> =>
  Effect.gen(function* () {
    const value = row[cursorField];
    if (typeof value === "string") return value;
    const now = yield* DateTime.now;
    return DateTime.formatIso(now);
  });

const isOnOrBeforeCutoff = (value: unknown, cutoff: Cursor) => {
  if (typeof value !== "string") return false;
  return new Date(value).getTime() <= toDate(cutoff).getTime();
};

// Stream helpers
const setCutoff = (deferred: Deferred.Deferred<Cursor, never>, cursor: Cursor) =>
  Deferred.succeed(deferred, cursor).pipe(Effect.asVoid);

export const dispatchEntityWebhook = <T extends Record<string, unknown>>(options: {
  readonly queue: WebhookStream<T>;
  readonly cutoff: Deferred.Deferred<Cursor, never>;
  readonly row: T;
  readonly cursor: Cursor;
}): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    yield* setCutoff(options.cutoff, options.cursor);
    yield* Queue.offer(options.queue.queue, {
      cursor: options.cursor,
      rows: [options.row],
    }).pipe(Effect.asVoid);
  });

/** Backfill stream for a single entity. Paging continues until the end. */
const makeBackfillStream = <T extends Record<string, unknown>>(options: {
  readonly api: PolarApiClientService;
  readonly schema: Schema.Decoder<T>;
  readonly path: string;
  readonly cutoff: Deferred.Deferred<Cursor, never>;
  readonly cursorField: keyof T & string;
  readonly limit?: number;
}): Stream.Stream<Batch<T>, ConnectorError> => {
  const sorting = `-${options.cursorField}`;
  return Stream.fromEffect(Deferred.await(options.cutoff)).pipe(
    Stream.flatMap((cutoff) =>
      makePullStream<T, never>({
        fetchPage: (cursor: Cursor | undefined) => {
          const page = cursor ? Number(cursor) : 1;
          return options.api
            .fetchList(options.schema, options.path, {
              page,
              limit: options.limit ?? 100,
              sorting,
            })
            .pipe(
              Effect.map((response) => {
                if (response.items.length === 0) {
                  return { cursor: page, rows: [], hasMore: false };
                }

                const filtered = response.items.filter((row: T) =>
                  isOnOrBeforeCutoff(row[options.cursorField], cutoff),
                );

                const keepPaging = page < response.pagination.max_page;

                return {
                  cursor: keepPaging ? page + 1 : page,
                  rows: filtered,
                  hasMore: keepPaging,
                };
              }),
            );
        },
      }),
    ),
  );
};

export type EntityStreams<T extends Record<string, unknown>> = {
  readonly live: WebhookStream<T>;
  readonly cutoff: Deferred.Deferred<Cursor, never>;
  readonly backfill: Stream.Stream<Batch<T>, ConnectorError>;
};

/** Creates the webhook queue, cutoff deferred, and backfill stream for one entity. */
export const makeEntityStreams = <T extends Record<string, unknown>>(options: {
  readonly api: PolarApiClientService;
  readonly schema: Schema.Decoder<T>;
  readonly path: string;
  readonly cursorField: keyof T & string;
  readonly limit?: number;
}): Effect.Effect<EntityStreams<T>, ConnectorError> =>
  Effect.gen(function* () {
    const queue = yield* makeWebhookQueue<T>({ capacity: 2048 });
    const cutoff = yield* Deferred.make<Cursor, never>();
    const backfill = makeBackfillStream<T>({ ...options, cutoff });
    return { live: queue, cutoff, backfill };
  });
