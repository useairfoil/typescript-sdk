import { Effect, Option, Stream } from "effect";
import type { ConnectorError } from "../core/errors";
import type { Batch, Cursor } from "../core/types";

export type PullPage<T> = {
  readonly cursor: Cursor;
  readonly rows: ReadonlyArray<T>;
  readonly hasMore: boolean;
};

export type PullFetcher<T, R = never> = (
  cursor: Cursor | undefined,
) => Effect.Effect<PullPage<T>, ConnectorError, R>;

export type PullStreamOptions<T, R = never> = {
  readonly initialCursor?: Cursor;
  readonly fetchPage: PullFetcher<T, R>;
};

export const makePullStream = <T, R = never>(
  options: PullStreamOptions<T, R>,
): Stream.Stream<Batch<T>, ConnectorError, R> =>
  Stream.unfoldEffect({ cursor: options.initialCursor, done: false }, (state) =>
    Effect.gen(function* () {
      if (state.done) {
        return Option.none();
      }

      let nextCursor: Cursor | undefined = state.cursor;

      while (true) {
        const page = yield* options.fetchPage(nextCursor);

        if (page.rows.length > 0) {
          const batch: Batch<T> = {
            cursor: page.cursor,
            rows: page.rows,
          };

          return Option.some([
            batch,
            page.hasMore
              ? { cursor: page.cursor, done: false }
              : { cursor: undefined, done: true },
          ]);
        }

        if (!page.hasMore) {
          return Option.none();
        }

        nextCursor = page.cursor;
      }
    }),
  );
