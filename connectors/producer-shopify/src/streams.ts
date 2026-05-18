import { type Batch, ConnectorError, type Cursor, Streams } from "@useairfoil/connector-kit";
import { DateTime, Deferred, Effect, Queue, Stream } from "effect";

const toEpochMillis = (value: unknown): number | undefined => {
  if (DateTime.isDateTime(value)) return DateTime.toEpochMillis(value);
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
        return DateTime.fromDateUnsafe(value);
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

export type BackfillPage<T extends Record<string, unknown>> = {
  readonly cursor: Cursor;
  readonly rows: ReadonlyArray<T>;
  readonly hasMore: boolean;
};

export type FetchBackfillPage<T extends Record<string, unknown>> = (
  cursor: Cursor | undefined,
) => Effect.Effect<BackfillPage<T>, ConnectorError>;

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

const makeBackfillStream = <T extends Record<string, unknown>>(options: {
  readonly fetchBackfillPage: FetchBackfillPage<T>;
  readonly cutoff: Deferred.Deferred<Cursor, never>;
  readonly cursorField: keyof T & string;
}): Stream.Stream<Batch<T>, ConnectorError> =>
  Stream.fromEffect(Deferred.await(options.cutoff)).pipe(
    Stream.flatMap((cutoff) =>
      Streams.makePullStream<T, never>({
        fetchPage: (cursor: Cursor | undefined) =>
          options.fetchBackfillPage(cursor).pipe(
            Effect.map((response) => ({
              cursor: response.cursor,
              rows: response.rows.filter((row: T) =>
                isOnOrBeforeCutoff(row[options.cursorField], cutoff),
              ),
              hasMore: response.hasMore,
            })),
          ),
      }),
    ),
  );

export type EntityStreams<T extends Record<string, unknown>> = {
  readonly live: Streams.WebhookStream<T>;
  readonly cutoff: Deferred.Deferred<Cursor, never>;
  readonly backfill: Stream.Stream<Batch<T>, ConnectorError>;
};

export const makeEntityStreams = Effect.fnUntraced(function* <
  T extends Record<string, unknown>,
>(options: {
  readonly fetchBackfillPage: FetchBackfillPage<T>;
  readonly cursorField: keyof T & string;
}) {
  const queue = yield* Streams.makeWebhookQueue<T>({ capacity: 1024 });
  const cutoff = yield* Deferred.make<Cursor, never>();
  const backfill = makeBackfillStream<T>({ ...options, cutoff });
  return { live: queue, cutoff, backfill };
});
