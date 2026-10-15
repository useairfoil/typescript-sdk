import { ConnectorError, Cursor, Fetch } from "@useairfoil/connector-kit";
import { DateTime, Duration, Effect, Option, Schema, SchemaTransformation } from "effect";

import type { HubSpotClientService } from "../../client/client";
import type { CrmReader } from "./read";
import type { CrmSpec, DeleteRow } from "./spec";

import { ArchivedObjectSchema, CrmObjectSchema, listPage } from "../../schemas/api";
import { objectsPath } from "./read";
import {
  SearchPassSchema,
  type SearchPass,
  type StartedPass,
  searchStep,
  startPass,
} from "./search";

export const changesInterval = Duration.minutes(5);
// HubSpot says updates take "a few moments" to reach search, so the search
// stops this far behind now. The full read catches anything later.
const searchLag = Duration.minutes(2);
const archiveInterval = Duration.hours(1);
const maxPagesPerRun = 20;
const listPageSize = "100";

const IdPageSchema = listPage(CrmObjectSchema);

/**
 * A full read of a list, page by page. `startedAt` is set while it runs, and
 * `after` says where it goes on.
 */
const ListPassSchema = Schema.Struct({
  last: Schema.DateTimeUtcFromString,
  startedAt: Schema.optional(Schema.DateTimeUtcFromString),
  after: Schema.optional(Schema.String),
});

type ListPass = Schema.Schema.Type<typeof ListPassSchema>;

/**
 * `refresh.last` is when the last full read started, and `archive.last` when
 * the last archived scan started. Deletes archived since then are sent.
 */
const ChangesCursorSchema = Schema.Struct({
  recent: SearchPassSchema,
  refresh: ListPassSchema,
  archive: ListPassSchema,
});

type ChangesCursor = Schema.Schema.Type<typeof ChangesCursorSchema>;

const ChangesCursorCodec = Schema.Union([
  Schema.fromJsonString(ChangesCursorSchema),
  // The first cursor is the backfill cutoff, a plain ISO time.
  Schema.DateTimeUtcFromString.pipe(
    Schema.decodeTo(
      Schema.toType(ChangesCursorSchema),
      SchemaTransformation.transform({
        decode: (cutoff): ChangesCursor => ({
          recent: { from: cutoff },
          refresh: { last: cutoff },
          archive: { last: cutoff },
        }),
        encode: (cursor) => cursor.recent.from,
      }),
    ),
  ),
]);

const decodeCursor = (value: string) =>
  Schema.decodeUnknownEffect(ChangesCursorCodec)(value).pipe(
    Effect.mapError(
      (cause) => new ConnectorError({ message: "Invalid HubSpot changes cursor", cause }),
    ),
  );

const encodeCursor = (cursor: ChangesCursor) =>
  Schema.encodeEffect(Schema.fromJsonString(ChangesCursorSchema))(cursor).pipe(
    Effect.mapError(
      (cause) => new ConnectorError({ message: "Could not encode HubSpot changes cursor", cause }),
    ),
  );

/**
 * The first cursor of an object type that shows up after the backfill. The
 * full read is due right away, so it reads every record once.
 */
export const freshCursor = (now: DateTime.Utc) =>
  encodeCursor({
    recent: { from: now },
    refresh: { last: DateTime.makeUnsafe(0) },
    archive: { last: now },
  });

const startList = (pass: ListPass, now: DateTime.Utc, interval: Duration.Duration): ListPass =>
  pass.startedAt === undefined &&
  DateTime.isGreaterThanOrEqualTo(now, DateTime.addDuration(pass.last, interval))
    ? { last: pass.last, startedAt: now }
    : pass;

const listStep = <Item>(
  client: HubSpotClientService,
  item: Schema.Decoder<Item>,
  object: string,
  pass: ListPass,
  params: Readonly<Record<string, string>> = {},
) =>
  client
    .get(listPage(item), objectsPath(object), {
      limit: listPageSize,
      properties: "hs_object_id",
      ...params,
      ...(pass.after === undefined ? {} : { after: pass.after }),
    })
    .pipe(
      Effect.map(({ body, fetchedAt }) => ({
        items: body.results,
        fetchedAt,
        pass: (body.paging === undefined
          ? { last: pass.startedAt ?? pass.last }
          : { ...pass, after: body.paging.next.after }) satisfies ListPass,
      })),
    );

const isStarted = (pass: SearchPass): pass is StartedPass => pass.until !== undefined;

type Step = {
  readonly state: ChangesCursor;
  readonly ids: ReadonlyArray<string>;
  readonly deletes: ReadonlyArray<DeleteRow>;
};

const startPasses = <Row extends object>(
  spec: CrmSpec<Row>,
  state: ChangesCursor,
  now: DateTime.Utc,
): ChangesCursor => ({
  recent: startPass(state.recent, now, searchLag),
  archive: spec.listsDeleted ? startList(state.archive, now, archiveInterval) : state.archive,
  refresh: startList(state.refresh, now, spec.refreshInterval),
});

/**
 * The next page of a running pass, in order: the search, the archived list, and
 * the full read. None when all are done.
 */
const nextStep = <Row extends object>(
  client: HubSpotClientService,
  spec: CrmSpec<Row>,
  state: ChangesCursor,
): Option.Option<Effect.Effect<Step, ConnectorError>> => {
  const { recent, archive, refresh } = state;
  if (isStarted(recent)) {
    return Option.some(
      searchStep(client, spec, recent).pipe(
        Effect.map(({ ids, pass }) => ({ state: { ...state, recent: pass }, ids, deletes: [] })),
      ),
    );
  }
  if (spec.listsDeleted && archive.startedAt !== undefined) {
    const since = DateTime.toEpochMillis(archive.last);
    return Option.some(
      listStep(client, ArchivedObjectSchema, spec.name, archive, { archived: "true" }).pipe(
        Effect.map(({ items, fetchedAt, pass }) => ({
          state: { ...state, archive: pass },
          ids: [],
          // The scan time, not `archivedAt`, so a later scan beats a read that
          // finished just after the delete.
          deletes: items
            .filter((item) => item.archivedAt.getTime() >= since)
            .map((item): DeleteRow => ({ id: item.id, version: fetchedAt, _deleted: true })),
        })),
      ),
    );
  }
  if (refresh.startedAt !== undefined) {
    return Option.some(
      listStep(client, CrmObjectSchema, spec.name, refresh).pipe(
        Effect.map(({ items, pass }) => ({
          state: { ...state, refresh: pass },
          ids: items.map((item) => item.id),
          deletes: [],
        })),
      ),
    );
  }
  return Option.none();
};

export const crmChanges = <Row extends object>(
  client: HubSpotClientService,
  reader: CrmReader<Row>,
  spec: CrmSpec<Row>,
) =>
  Fetch.changes({
    cursor: Cursor.string(),
    interval: changesInterval,
    fetch: ({ cursor }) =>
      Effect.gen(function* () {
        const now = yield* DateTime.now;
        const state = startPasses(spec, yield* decodeCursor(String(cursor)), now);
        let done: Step = { state, ids: [], deletes: [] };
        let next = nextStep(client, spec, done.state);
        for (let page = 0; page < maxPagesPerRun && Option.isSome(next); page++) {
          const step = yield* next.value;
          done = {
            state: step.state,
            ids: [...done.ids, ...step.ids],
            deletes: [...done.deletes, ...step.deletes],
          };
          next = nextStep(client, spec, done.state);
        }

        const read = yield* reader.read(done.ids);
        return {
          rows: [...read.rows, ...read.merged, ...done.deletes],
          cursor: yield* encodeCursor(done.state),
          hasMore: Option.isSome(next),
        };
      }),
  });

const parseCutoff = (value: string) => DateTime.toEpochMillis(DateTime.makeUnsafe(value));

/**
 * Reads IDs by the list endpoint, then the rows. Records created after the
 * cutoff are left to changes.
 */
export const crmBackfill = <Row extends object>(
  client: HubSpotClientService,
  reader: CrmReader<Row>,
  spec: CrmSpec<Row>,
) =>
  Fetch.page({
    pageCursor: Cursor.string(),
    cutoff: Cursor.isoDateTime(),
    fetch: ({ pageCursor, cutoff }) =>
      Effect.gen(function* () {
        const cutoffMillis = parseCutoff(String(cutoff));
        const { body } = yield* client.get(IdPageSchema, objectsPath(spec.name), {
          limit: listPageSize,
          properties: "hs_object_id",
          ...(typeof pageCursor === "string" ? { after: pageCursor } : {}),
        });
        const read = yield* reader.read(
          body.results
            .filter((item) => item.createdAt.getTime() <= cutoffMillis)
            .map((item) => item.id),
        );
        return {
          rows: read.rows,
          nextPageCursor: body.paging?.next.after,
          hasMore: body.paging !== undefined,
        };
      }),
  });

export const crmCheck = <Row extends object>(
  client: HubSpotClientService,
  reader: CrmReader<Row>,
  spec: CrmSpec<Row>,
): Effect.Effect<void, ConnectorError> =>
  Effect.all(
    [client.get(IdPageSchema, objectsPath(spec.name), { limit: "1" }), reader.propertyNames],
    { discard: true },
  );
