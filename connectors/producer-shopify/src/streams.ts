import type * as Schema from "effect/Schema";

import { type Batch, ConnectorError, type Cursor, Streams } from "@useairfoil/connector-kit";
import { Deferred, Effect, Queue, Stream } from "effect";

import type { ShopifyApiClientService } from "./api";

const toEpochMillis = (value: unknown): number | undefined => {
  if (value instanceof Date) {
    return value.getTime();
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
};

const isOnOrBeforeCutoff = (value: unknown, cutoff: Cursor): boolean => {
  const valueMillis = toEpochMillis(value);
  const cutoffMillis = toEpochMillis(cutoff);
  if (valueMillis == null || cutoffMillis == null) {
    return false;
  }
  return valueMillis <= cutoffMillis;
};

export const resolveCursor = <T extends Record<string, unknown>>(
  row: T,
  cursorField: keyof T & string,
): Effect.Effect<Cursor, ConnectorError> =>
  Effect.try({
    try: () => {
      const value = row[cursorField];
      if (typeof value === "string" || typeof value === "number") {
        return value;
      }
      if (value instanceof Date) {
        return value;
      }
      throw new Error(`Unsupported cursor value for field '${cursorField}'`);
    },
    catch: (cause) =>
      new ConnectorError({
        message: "Failed to resolve Shopify cursor",
        cause,
      }),
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
  readonly api: ShopifyApiClientService;
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
          const nextUrl = typeof cursor === "string" ? cursor : undefined;
          return options.api
            .fetchList(options.schema, options.path, {
              limit: options.limit ?? 10,
              nextUrl,
            })
            .pipe(
              Effect.map((response) => {
                if (response.items.length === 0) {
                  return {
                    cursor: nextUrl ?? options.path,
                    rows: [],
                    hasMore: false,
                  };
                }

                const filtered = response.items.filter((row: T) =>
                  isOnOrBeforeCutoff(row[options.cursorField], cutoff),
                );

                return {
                  cursor: response.nextUrl ?? nextUrl ?? options.path,
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
  readonly api: ShopifyApiClientService;
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
