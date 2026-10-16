import { ConnectorError, Cursor, Fetch } from "@useairfoil/connector-kit";
import {
  Array as Arr,
  DateTime,
  Duration,
  Effect,
  Option,
  Schema,
  SchemaTransformation,
  Stream,
  String as Str,
} from "effect";

import type { LinearClientService } from "../client/client";

const changesInterval = Duration.minutes(5);
const hourly = Duration.hours(1);
// A run stops after this many pages and the next one starts right away.
const maxPagesPerRun = 20;
// Updates can show up in a list late, so each changes read starts a bit early.
const changesOverlap = Duration.minutes(1);

type ListSpec<Item, Row> = {
  /** List query, such as `issues`. */
  readonly connection: string;
  /** Single-item query for webhooks, such as `issue`. */
  readonly single?: string;
  /** GraphQL fields, aliased to match the schema. */
  readonly fields: string;
  readonly item: Schema.Decoder<Item>;
  /** Page size. Lower it for queries with nested lists. */
  readonly first?: number;
  readonly updatedAt: (item: Item) => Date;
  /** Builds rows and may fetch more nested pages. */
  readonly rows: (items: ReadonlyArray<Item>) => Effect.Effect<ReadonlyArray<Row>, ConnectorError>;
};

/** Keeps item types inferred in the callbacks. */
export const listSpec = <Item, Row>(spec: ListSpec<Item, Row>) => spec;

export const rowsOf =
  <Item, Row>(toRow: (item: Item) => Row) =>
  (items: ReadonlyArray<Item>) =>
    Effect.succeed(items.map(toRow));

type Page<Item> = {
  readonly items: ReadonlyArray<Item>;
  readonly next: Option.Option<string>;
};

const PageInfoSchema = Schema.Struct({
  hasNextPage: Schema.Boolean,
  endCursor: Schema.NullOr(Schema.String),
});

const readPage = <Item, Row>(
  client: LinearClientService,
  spec: ListSpec<Item, Row>,
  options: {
    readonly orderBy: "createdAt" | "updatedAt";
    readonly after: Option.Option<string>;
    readonly first?: number;
  },
): Effect.Effect<Page<Item>, ConnectorError> =>
  client
    .query(
      Schema.Struct({
        page: Schema.Struct({ nodes: Schema.Array(spec.item), pageInfo: PageInfoSchema }),
      }).pipe(Schema.encodeKeys({ page: spec.connection })),
      `query ${Str.capitalize(spec.connection)}($first: Int!, $after: String, $orderBy: PaginationOrderBy) {
  ${spec.connection}(first: $first, after: $after, orderBy: $orderBy, includeArchived: true) {
    nodes { ${spec.fields} }
    pageInfo { hasNextPage endCursor }
  }
}`,
      {
        first: options.first ?? spec.first ?? 250,
        after: Option.getOrNull(options.after),
        orderBy: options.orderBy,
      },
    )
    .pipe(
      Effect.map(({ page }) => ({
        items: page.nodes,
        next: page.pageInfo.hasNextPage
          ? Option.fromNullishOr(page.pageInfo.endCursor)
          : Option.none(),
      })),
    );

const listAll = <Item, Row>(
  client: LinearClientService,
  spec: ListSpec<Item, Row>,
): Effect.Effect<ReadonlyArray<Item>, ConnectorError> =>
  Stream.paginate(Option.none<string>(), (after) =>
    readPage(client, spec, { orderBy: "createdAt", after }).pipe(
      Effect.map(({ items, next }) => [items, Option.map(next, Option.some)] as const),
    ),
  ).pipe(Stream.runCollect);

export const checkList = <Item, Row>(client: LinearClientService, spec: ListSpec<Item, Row>) =>
  readPage(client, spec, { orderBy: "createdAt", after: Option.none(), first: 1 }).pipe(
    Effect.flatMap(({ items }) => spec.rows(items)),
    Effect.asVoid,
  );

/** Small lists are read in full every hour. */
export const listSources = <Item, Row extends object>(
  client: LinearClientService,
  spec: ListSpec<Item, Row>,
) => {
  const read = listAll(client, spec).pipe(Effect.flatMap(spec.rows));
  return {
    check: checkList(client, spec),
    backfill: Fetch.page({
      pageCursor: Cursor.string(),
      cutoff: Cursor.isoDateTime(),
      fetch: () => read.pipe(Effect.map((rows) => ({ rows, hasMore: false }))),
    }),
    changes: Fetch.changes({
      cursor: Cursor.string(),
      interval: hourly,
      fetch: () =>
        Effect.all([read, DateTime.now]).pipe(
          Effect.map(([rows, now]) => ({ rows, cursor: DateTime.formatIso(now) })),
        ),
    }),
  };
};

/** Changes pick up items created during backfill. */
export const backfillList = <Item, Row extends object>(
  client: LinearClientService,
  spec: ListSpec<Item, Row>,
) =>
  Fetch.page({
    pageCursor: Cursor.string(),
    cutoff: Cursor.isoDateTime(),
    fetch: ({ pageCursor }) =>
      Effect.gen(function* () {
        const page = yield* readPage(client, spec, {
          orderBy: "createdAt",
          after: Option.fromNullishOr(typeof pageCursor === "string" ? pageCursor : undefined),
        });
        return {
          rows: yield* spec.rows(page.items),
          hasMore: Option.isSome(page.next),
          ...Option.match(page.next, {
            onNone: () => ({}),
            onSome: (nextPageCursor) => ({ nextPageCursor }),
          }),
        };
      }),
  });

/**
 * `since` is when the last run started. `pending` is set while a run is split:
 * `until` is the start of that run, and `after` the page to go on from.
 */
const ChangesCursorSchema = Schema.Struct({
  since: Schema.DateTimeUtcFromString,
  pending: Schema.optional(
    Schema.Struct({ until: Schema.DateTimeUtcFromString, after: Schema.String }),
  ),
});

type ChangesCursor = Schema.Schema.Type<typeof ChangesCursorSchema>;

const ChangesCursorCodec = Schema.Union([
  Schema.fromJsonString(ChangesCursorSchema),
  // The first cursor is the backfill cutoff, a plain ISO time.
  Schema.DateTimeUtcFromString.pipe(
    Schema.decodeTo(
      Schema.toType(ChangesCursorSchema),
      SchemaTransformation.transform({
        decode: (since): ChangesCursor => ({ since }),
        encode: (cursor) => cursor.since,
      }),
    ),
  ),
]);

const cursorError = (cause: Schema.SchemaError) =>
  new ConnectorError({ message: "Invalid Linear changes cursor", cause });

/**
 * Newest first: an edit during paging is read again on the next run.
 */
export const changesList = <Item, Row extends object>(
  client: LinearClientService,
  spec: ListSpec<Item, Row>,
) =>
  Fetch.changes({
    cursor: Cursor.string(),
    interval: changesInterval,
    fetch: ({ cursor }) =>
      Effect.gen(function* () {
        const state = yield* Schema.decodeUnknownEffect(ChangesCursorCodec)(String(cursor)).pipe(
          Effect.mapError(cursorError),
        );
        const until = state.pending?.until ?? (yield* DateTime.now);
        const from = DateTime.toDateUtc(DateTime.subtractDuration(state.since, changesOverlap));
        const isRecent = (item: Item) => spec.updatedAt(item).getTime() >= from.getTime();

        const pages = yield* Stream.paginate(Option.fromNullishOr(state.pending?.after), (after) =>
          Effect.gen(function* () {
            const page = yield* readPage(client, spec, { orderBy: "updatedAt", after });
            const recent = page.items.filter(isRecent);
            const next = recent.length === page.items.length ? page.next : Option.none();
            const rows = yield* spec.rows(recent);
            return [[{ rows, next }], Option.map(next, Option.some)] as const;
          }),
        ).pipe(Stream.take(maxPagesPerRun), Stream.runCollect);

        const rows = pages.flatMap((page) => page.rows);
        const after = Option.flatMap(Arr.last(pages), (page) => page.next);
        const next: ChangesCursor =
          pages.length === maxPagesPerRun && Option.isSome(after)
            ? { since: state.since, pending: { until, after: after.value } }
            : { since: until };
        return {
          rows,
          cursor: yield* Schema.encodeEffect(Schema.fromJsonString(ChangesCursorSchema))(next).pipe(
            Effect.mapError(cursorError),
          ),
          hasMore: next.pending !== undefined,
        };
      }),
  });

const WebhookPayloadSchema = Schema.Struct({
  data: Schema.Struct({ id: Schema.String }),
  webhookTimestamp: Schema.Number,
});

type WebhookPayload = Schema.Schema.Type<typeof WebhookPayloadSchema>;

/**
 * Archive and trash also send `remove`, without changing `updatedAt`.
 * Read the item again; delete only if it's gone. Use the webhook time as the version.
 */
export const webhookList = <Item, Row extends object>(
  client: LinearClientService,
  spec: ListSpec<Item, Row>,
) => ({
  schema: WebhookPayloadSchema,
  handler: ({ payload }: { readonly payload: WebhookPayload }) =>
    Effect.gen(function* () {
      const version = new Date(payload.webhookTimestamp);
      const single = spec.single ?? spec.connection;
      const found = yield* client.find(
        Schema.Struct({ item: spec.item }).pipe(Schema.encodeKeys({ item: single })),
        `query ${Str.capitalize(single)}($id: String!) {
  ${single}(id: $id) { ${spec.fields} }
}`,
        { id: payload.data.id },
      );
      return yield* Option.match(found, {
        onNone: () => Effect.succeed([{ id: payload.data.id, version, _deleted: true as const }]),
        onSome: ({ item }) =>
          spec.rows([item]).pipe(Effect.map((rows) => rows.map((row) => ({ ...row, version })))),
      });
    }),
});
