import {
  type Batch,
  type ConnectorError,
  type Cursor,
  makePullStream,
  makeWebhookQueue,
  type WebhookStream,
} from "@useairfoil/connector-kit";
import { Deferred, Effect, Queue, Stream } from "effect";
import type { PolarApiClientService } from "./api";

// Cursor helpers
const toDate = (cursor: Cursor) =>
  cursor instanceof Date ? cursor : new Date(String(cursor));

export const resolveCursor = <T extends Record<string, unknown>>(
  row: T,
  cursorField: keyof T & string,
): Cursor => {
  const value = row[cursorField];
  return typeof value === "string" ? value : new Date().toISOString();
};

const isAfterCutoff = (value: unknown, cutoff: Cursor) => {
  if (typeof value !== "string") return true;
  return new Date(value).getTime() > toDate(cutoff).getTime();
};

// Stream helpers
const setCutoff = (
  deferred: Deferred.Deferred<Cursor, never>,
  cursor: Cursor,
) => Deferred.succeed(deferred, cursor).pipe(Effect.asVoid);

export const dispatchEntityWebhook = <
  T extends Record<string, unknown>,
>(options: {
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

/** Backfill stream for a single entity. Paging stops once items are older than the live cutoff. */
const makeBackfillStream = <T extends Record<string, unknown>>(options: {
  readonly api: PolarApiClientService;
  readonly path: string;
  readonly cutoff: Deferred.Deferred<Cursor, never>;
  readonly cursorField: keyof T & string;
  readonly limit?: number;
}): Stream.Stream<Batch<T>, ConnectorError> => {
  const sorting = `-${options.cursorField}`;
  return Stream.fromEffect(Deferred.await(options.cutoff)).pipe(
    Stream.flatMap((cutoff) =>
      makePullStream({
        fetchPage: (cursor: Cursor | undefined) =>
          Effect.gen(function* () {
            const page = cursor ? Number(cursor) : 1;
            const response = yield* options.api.fetchList<T>(options.path, {
              page,
              limit: options.limit ?? 100,
              sorting,
            });

            if (response.items.length === 0) {
              return { cursor: page, rows: [], hasMore: false };
            }

            const filtered = response.items.filter((row) =>
              isAfterCutoff(row[options.cursorField], cutoff),
            );

            const oldest = response.items[response.items.length - 1];
            const keepPaging =
              !!oldest &&
              isAfterCutoff(oldest[options.cursorField], cutoff) &&
              page < response.pagination.max_page;

            return {
              cursor: keepPaging ? page + 1 : page,
              rows: filtered,
              hasMore: keepPaging,
            };
          }),
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
