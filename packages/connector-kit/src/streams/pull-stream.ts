import { Effect, Option, Stream } from "effect";
import type { ConnectorError } from "../core/errors";
import type { Batch, Cursor } from "../core/types";

export type PullPage<T> = {
  readonly cursor: Cursor;
  readonly rows: ReadonlyArray<T>;
  readonly hasMore: boolean;
};

export type PullFetcher<T> = (
  cursor: Cursor | undefined,
) => Effect.Effect<PullPage<T>, ConnectorError>;

export type PullStreamOptions<T> = {
  readonly initialCursor?: Cursor;
  readonly fetchPage: PullFetcher<T>;
};

export const makePullStream = <T>(
  options: PullStreamOptions<T>,
): Stream.Stream<Batch<T>, ConnectorError> =>
  Stream.unfoldEffect(options.initialCursor, (cursor) =>
    Effect.gen(function* () {
      let nextCursor: Cursor | undefined = cursor;

      while (true) {
        const page = yield* options.fetchPage(nextCursor);

        if (page.rows.length > 0) {
          const batch: Batch<T> = {
            cursor: page.cursor,
            rows: page.rows,
          };

          return Option.some(
            page.hasMore ? [batch, page.cursor] : [batch, undefined],
          );
        }

        if (!page.hasMore) {
          return Option.none();
        }

        nextCursor = page.cursor;
      }
    }),
  );
