import { Effect, Stream } from "effect";

import type { Batch, Cursor } from "../core/types";
import type { ConnectorError } from "../errors";

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
  Stream.unfold(
    { cursor: options.initialCursor, done: false },
    Effect.fnUntraced(function* (state) {
      if (state.done) {
        return undefined;
      }

      let nextCursor: Cursor | undefined = state.cursor;

      while (true) {
        const page = yield* options.fetchPage(nextCursor);

        if (page.rows.length > 0) {
          const batch: Batch<T> = {
            cursor: page.cursor,
            rows: page.rows,
          };

          return [
            batch,
            page.hasMore ? { cursor: page.cursor, done: false } : { cursor: undefined, done: true },
          ] as const;
        }

        if (!page.hasMore) {
          return undefined;
        }

        nextCursor = page.cursor;
      }
    }),
  );
