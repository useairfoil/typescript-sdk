import { type ConnectorError, Cursor, Fetch } from "@useairfoil/connector-kit";
import { DateTime, Duration, Effect, type Schema } from "effect";

import type { ZendeskClientService } from "../client/client";

const changesInterval = Duration.minutes(5);

const millis = (time: string) => DateTime.toEpochMillis(DateTime.makeUnsafe(time));

// Zendesk leaves out the latest minute. Overlap the cutoff to catch it.
const firstStartTime = (cutoff: string) =>
  String(Math.floor((millis(cutoff) - Duration.toMillis(Duration.minutes(1))) / 1000));

// Only the cutoff is an ISO time. A cursor such as `1` also parses as a date.
const isCutoff = (cursor: string) => /^\d{4}-\d{2}-\d{2}T/.test(cursor);

const check = (
  client: ZendeskClientService,
  path: string,
  schema: Schema.Decoder<unknown>,
): Effect.Effect<void, ConnectorError> =>
  client.get(schema, path, { start_time: "0", per_page: "1" }).pipe(Effect.asVoid);

type ExportOptions<Page, Row> = {
  readonly client: ZendeskClientService;
  readonly path: string;
  readonly schema: Schema.Decoder<Page>;
  readonly params?: Readonly<Record<string, string>>;
  readonly rows: (page: Page) => Effect.Effect<ReadonlyArray<Row>, ConnectorError>;
};

export const cursorExport = <
  Page extends { readonly after_cursor: string | null; readonly end_of_stream: boolean },
  // Rows come in version order, so the backfill can stop past the cutoff.
  Row extends { readonly version: Date },
>(
  options: ExportOptions<Page, Row>,
) => {
  const read = (params: Readonly<Record<string, string>>) =>
    options.client
      .get(options.schema, options.path, { ...options.params, ...params })
      .pipe(
        Effect.flatMap((page) => options.rows(page).pipe(Effect.map((rows) => ({ page, rows })))),
      );

  return {
    check: check(options.client, options.path, options.schema),
    backfill: Fetch.page({
      pageCursor: Cursor.string(),
      cutoff: Cursor.isoDateTime(),
      fetch: ({ pageCursor, cutoff }) =>
        read(pageCursor === undefined ? { start_time: "0" } : { cursor: String(pageCursor) }).pipe(
          Effect.map(({ page, rows }) => {
            const last = rows.at(-1);
            const pastCutoff =
              last !== undefined && last.version.getTime() > millis(String(cutoff));
            const next = page.end_of_stream || pastCutoff ? null : page.after_cursor;
            return next === null
              ? { rows, hasMore: false }
              : { rows, hasMore: true, nextPageCursor: next };
          }),
        ),
    }),
    changes: Fetch.changes({
      cursor: Cursor.string(),
      interval: changesInterval,
      fetch: ({ cursor }) => {
        const value = String(cursor);
        return read(
          isCutoff(value) ? { start_time: firstStartTime(value) } : { cursor: value },
        ).pipe(
          Effect.map(({ page, rows }) => ({
            rows,
            cursor: page.after_cursor ?? value,
            hasMore: !page.end_of_stream,
          })),
        );
      },
    }),
  };
};

// Zendesk's end_time is the next start_time. Rows at the page edge can repeat.
export const timeExport = <
  Page extends { readonly end_time: number | null; readonly end_of_stream: boolean },
  Row extends object,
>(
  options: ExportOptions<Page, Row>,
) => {
  const read = (startTime: string) =>
    options.client
      .get(options.schema, options.path, { ...options.params, start_time: startTime })
      .pipe(
        Effect.flatMap((page) => options.rows(page).pipe(Effect.map((rows) => ({ page, rows })))),
      );

  return {
    check: check(options.client, options.path, options.schema),
    backfill: Fetch.page({
      pageCursor: Cursor.string(),
      cutoff: Cursor.isoDateTime(),
      fetch: ({ pageCursor, cutoff }) =>
        read(pageCursor === undefined ? "0" : String(pageCursor)).pipe(
          Effect.map(({ page, rows }) => {
            const hasMore =
              !page.end_of_stream &&
              page.end_time !== null &&
              page.end_time * 1000 < millis(String(cutoff));
            return {
              rows,
              hasMore,
              ...(hasMore ? { nextPageCursor: String(page.end_time) } : {}),
            };
          }),
        ),
    }),
    changes: Fetch.changes({
      cursor: Cursor.string(),
      interval: changesInterval,
      fetch: ({ cursor }) => {
        const value = String(cursor);
        const startTime = isCutoff(value) ? firstStartTime(value) : value;
        return read(startTime).pipe(
          Effect.map(({ page, rows }) => ({
            rows,
            cursor: page.end_time === null ? startTime : String(page.end_time),
            hasMore: !page.end_of_stream,
          })),
        );
      },
    }),
  };
};
