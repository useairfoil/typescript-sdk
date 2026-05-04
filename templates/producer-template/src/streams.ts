import type * as Schema from "effect/Schema";

import { type Batch, type ConnectorError, type Cursor, Streams } from "@useairfoil/connector-kit";
import { Deferred, Effect, Queue, Stream } from "effect";

import type { TemplateApiClientService } from "./api";

// JSONPlaceholder has no timestamps, so we cursor on the numeric `id` field.
// For a real API prefer a monotonically increasing, server-emitted timestamp.
const toNumber = (cursor: Cursor): number => (typeof cursor === "number" ? cursor : Number(cursor));

const isOnOrBeforeCutoff = (value: unknown, cutoff: Cursor): boolean => {
  if (typeof value !== "number") return false;
  return value <= toNumber(cutoff);
};

export const resolveCursor = <T extends Record<string, unknown>>(
  row: T,
  cursorField: keyof T & string,
): Effect.Effect<Cursor> =>
  Effect.sync(() => {
    const value = row[cursorField];
    return typeof value === "number" ? value : Number(value);
  });

const setCutoff = (deferred: Deferred.Deferred<Cursor, never>, cursor: Cursor) =>
  Deferred.succeed(deferred, cursor).pipe(Effect.asVoid);

// Enqueue a single webhook row after recording its cursor as the backfill
// cutoff. This is safe to call many times — Deferred.succeed is idempotent.
export const dispatchEntityWebhook = Effect.fnUntraced(function* <
  T extends Record<string, unknown>,
>(options: {
  readonly queue: Streams.WebhookStream<T>;
  readonly cutoff: Deferred.Deferred<Cursor, never>;
  readonly row: T;
  readonly cursor: Cursor;
}) {
  yield* setCutoff(options.cutoff, options.cursor);
  return yield* Queue.offer(options.queue.queue, {
    cursor: options.cursor,
    rows: [options.row],
  }).pipe(Effect.asVoid);
});

// Backfill stream for a single entity. Waits for the cutoff deferred to
// resolve (set by the first live webhook or by initialCutoff), then pages
// through the list endpoint until hasMore is false.
const makeBackfillStream = <T extends Record<string, unknown>>(options: {
  readonly api: TemplateApiClientService;
  readonly schema: Schema.Decoder<T>;
  readonly path: string;
  readonly cutoff: Deferred.Deferred<Cursor, never>;
  readonly cursorField: keyof T & string;
  readonly limit?: number;
}): Stream.Stream<Batch<T>, ConnectorError> =>
  Stream.fromEffect(Deferred.await(options.cutoff)).pipe(
    Stream.flatMap((cutoff) =>
      Streams.makePullStream<T, never>({
        fetchPage: (cursor: Cursor | undefined) => {
          const page = cursor ? Number(cursor) : 1;
          return options.api
            .fetchList(options.schema, options.path, {
              page,
              limit: options.limit ?? 10,
            })
            .pipe(
              Effect.map((response) => {
                if (response.items.length === 0) {
                  return { cursor: page, rows: [], hasMore: false };
                }

                const filtered = response.items.filter((row: T) =>
                  isOnOrBeforeCutoff(row[options.cursorField], cutoff),
                );

                return {
                  cursor: response.hasMore ? page + 1 : page,
                  rows: filtered,
                  hasMore: response.hasMore,
                };
              }),
            );
        },
      }),
    ),
  );

export type EntityStreams<T extends Record<string, unknown>> = {
  readonly live: Streams.WebhookStream<T>;
  readonly cutoff: Deferred.Deferred<Cursor, never>;
  readonly backfill: Stream.Stream<Batch<T>, ConnectorError>;
};

// Convenience factory: creates the live webhook queue, the cutoff deferred,
// and the backfill stream all at once. Callers destructure the result into a
// defineEntity() call.
export const makeEntityStreams = Effect.fnUntraced(function* <
  T extends Record<string, unknown>,
>(options: {
  readonly api: TemplateApiClientService;
  readonly schema: Schema.Decoder<T>;
  readonly path: string;
  readonly cursorField: keyof T & string;
  readonly limit?: number;
}) {
  const queue = yield* Streams.makeWebhookQueue<T>({ capacity: 1024 });
  const cutoff = yield* Deferred.make<Cursor, never>();
  const backfill = makeBackfillStream<T>({ ...options, cutoff });
  return { live: queue, cutoff, backfill };
});
