import { ConnectorError, Cursor, Fetch } from "@useairfoil/connector-kit";
import {
  Array as Arr,
  DateTime,
  Duration,
  Effect,
  Exit,
  Option,
  Order,
  Schema,
  SchemaTransformation,
  Stream,
} from "effect";

import { type GitHubClientService, withParams } from "../client/client";
import { type RepositoryRef, RepositoryRefSchema } from "../schemas/repositories";

type Timestamps = { readonly created_at: Date; readonly updated_at: Date };

export type DeleteRow = {
  readonly id: bigint;
  readonly version: Date;
  readonly _deleted: true;
};

export const pageSize = "100";
export const changesInterval = Duration.minutes(15);
// A run stops after this many pages and the next one starts right away.
const maxChangesPagesPerRun = 20;
// Updates can show up in a list late, so each changes read starts a bit early.
const changesOverlap = Duration.minutes(5);
// How long the backfill reuses the repository list between pages.
const repositoryListTtl = Duration.minutes(5);

export const installationRepositoriesPath = "/installation/repositories";

export const repositoryPage = <A>(item: Schema.Decoder<A>) =>
  Schema.Struct({ repositories: Schema.Array(item) });

const readPages = <A>(
  client: GitHubClientService,
  pageSchema: Schema.Decoder<ReadonlyArray<A>>,
  url: string,
  keepGoing: (items: ReadonlyArray<A>) => boolean = () => true,
): Effect.Effect<ReadonlyArray<A>, ConnectorError> =>
  Stream.paginate(url, (current) =>
    client
      .get(pageSchema, current)
      .pipe(
        Effect.map(
          (page) => [page.body, keepGoing(page.body) ? page.next : Option.none()] as const,
        ),
      ),
  ).pipe(Stream.runCollect);

/** Every repository the installation can read, ordered by ID. */
export const listRepositories = <A extends { readonly id: number | bigint }>(
  client: GitHubClientService,
  schema: Schema.Decoder<A>,
): Effect.Effect<ReadonlyArray<A>, ConnectorError> =>
  readPages(
    client,
    repositoryPage(schema).pipe(
      Schema.decodeTo(
        Schema.Array(Schema.toType(schema)),
        SchemaTransformation.transform({
          decode: (page) => page.repositories,
          encode: (repositories) => ({ repositories }),
        }),
      ),
    ),
    withParams(installationRepositoriesPath, { per_page: pageSize }),
  ).pipe(
    Effect.map(Arr.sort(Order.mapInput(Order.Number, (repository: A) => Number(repository.id)))),
  );

export const cachedRepositoryRefs = (client: GitHubClientService) =>
  listRepositories(client, RepositoryRefSchema).pipe(
    Effect.cachedWithTTL((exit) => (Exit.isSuccess(exit) ? repositoryListTtl : 0)),
  );

/**
 * `since` is when the last run started, and `repositoryIds` are the
 * repositories it read. Any other repository is new and is read from the start.
 * `pending` is set while a run is split.
 */
const ChangesCursorSchema = Schema.Struct({
  since: Schema.DateTimeUtcFromString,
  repositoryIds: Schema.optional(Schema.Array(Schema.Number)),
  pending: Schema.optional(
    Schema.Struct({
      until: Schema.DateTimeUtcFromString,
      repositoryIds: Schema.Array(Schema.Number),
      repositoryId: Schema.Number,
      url: Schema.optional(Schema.String),
    }),
  ),
});

type ChangesCursor = Schema.Schema.Type<typeof ChangesCursorSchema>;

const ChangesCursorCodec = Schema.Union([
  Schema.fromJsonString(ChangesCursorSchema),
  // The first cursor is the backfill cutoff, a plain ISO time. Every repository
  // the installation has then counts as read.
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

const decodeChangesCursor = (value: string): Effect.Effect<ChangesCursor, ConnectorError> =>
  Schema.decodeUnknownEffect(ChangesCursorCodec)(value).pipe(
    Effect.mapError(
      (cause) => new ConnectorError({ message: "Invalid GitHub changes cursor", cause }),
    ),
  );

const encodeChangesCursor = (cursor: ChangesCursor): Effect.Effect<string, ConnectorError> =>
  Schema.encodeEffect(Schema.fromJsonString(ChangesCursorSchema))(cursor).pipe(
    Effect.mapError(
      (cause) => new ConnectorError({ message: "Could not encode GitHub changes cursor", cause }),
    ),
  );

/** When to read a repository's changes from. None means from the start. */
const readFrom = (state: ChangesCursor, repositoryId: number): Option.Option<Date> =>
  state.repositoryIds === undefined || state.repositoryIds.includes(repositoryId)
    ? Option.some(DateTime.toDateUtc(DateTime.subtractDuration(state.since, changesOverlap)))
    : Option.none();

export const isSince = (time: Option.Option<Date>, date: Date) =>
  Option.match(time, { onNone: () => true, onSome: (since) => date.getTime() >= since.getTime() });

export const readChanges = <A extends { readonly id: number | bigint }, Row>(
  cursor: string,
  repositories: Effect.Effect<ReadonlyArray<A>, ConnectorError>,
  toRows: (
    repositories: ReadonlyArray<{ readonly repository: A; readonly since: Option.Option<Date> }>,
  ) => ReadonlyArray<Row>,
) =>
  Effect.gen(function* () {
    const state = yield* decodeChangesCursor(cursor);
    const runStart = yield* DateTime.now;
    const listed = yield* repositories;
    return {
      rows: toRows(
        listed.map((repository) => ({
          repository,
          since: readFrom(state, Number(repository.id)),
        })),
      ),
      cursor: yield* encodeChangesCursor({
        since: runStart,
        repositoryIds: listed.map((repository) => Number(repository.id)),
      }),
    };
  });

export type RepoResourceSpec<Item extends Timestamps, Row extends object> = {
  readonly path: string;
  readonly itemSchema: Schema.Decoder<Item>;
  readonly params: Readonly<Record<string, string>>;
  /** Whether the list takes `since`. Without it, changes stop at the first older item. */
  readonly since: boolean;
  /** Items the resource keeps. The issues list also returns pull requests. */
  readonly keep: (item: Item) => boolean;
  /** GitHub returns 404 for pull requests and comments when the feature is off. */
  readonly enabled: (repository: RepositoryRef) => boolean;
  readonly toRow: (item: Item, repositoryId: bigint) => Row;
};

const repoPath = (repository: RepositoryRef, path: string) =>
  `/repos/${repository.full_name}/${path}`;

export const checkRepoResource = <Item extends Timestamps, Row extends object>(
  client: GitHubClientService,
  spec: RepoResourceSpec<Item, Row>,
): Effect.Effect<void, ConnectorError> =>
  Effect.gen(function* () {
    const page = yield* client.get(
      repositoryPage(RepositoryRefSchema),
      withParams(installationRepositoriesPath, { per_page: pageSize }),
    );
    // An installation without such a repository has nothing to check yet.
    const repository = Arr.findFirst(page.body.repositories, spec.enabled);
    if (Option.isSome(repository)) {
      yield* client.get(
        Schema.Array(spec.itemSchema),
        withParams(repoPath(repository.value, spec.path), { ...spec.params, per_page: "1" }),
      );
    }
  });

const BackfillCursorSchema = Schema.fromJsonString(
  Schema.Struct({
    repositoryId: Schema.Number,
    next: Schema.optional(Schema.String),
  }),
);

type BackfillCursor = Schema.Schema.Type<typeof BackfillCursorSchema>;

const decodeBackfillCursor = (value: string) =>
  Schema.decodeUnknownEffect(BackfillCursorSchema)(value).pipe(
    Effect.mapError(
      (cause) => new ConnectorError({ message: "Invalid GitHub backfill cursor", cause }),
    ),
  );

const encodeBackfillCursor = (cursor: BackfillCursor) =>
  Schema.encodeEffect(BackfillCursorSchema)(cursor).pipe(
    Effect.mapError(
      (cause) => new ConnectorError({ message: "Could not encode GitHub backfill cursor", cause }),
    ),
  );

export const parseCutoff = (value: string): Date => DateTime.toDateUtc(DateTime.makeUnsafe(value));

/**
 * Reads one repository at a time, oldest first, up to the cutoff. The cursor
 * keeps the `next` URL, because the issues list pages with a cursor.
 */
export const backfillRepoResource = <Item extends Timestamps, Row extends object>(
  client: GitHubClientService,
  repositories: Effect.Effect<ReadonlyArray<RepositoryRef>, ConnectorError>,
  spec: RepoResourceSpec<Item, Row>,
) =>
  Fetch.page({
    pageCursor: Cursor.string(),
    cutoff: Cursor.isoDateTime(),
    fetch: ({ pageCursor, cutoff }) =>
      Effect.gen(function* () {
        const cutoffDate = parseCutoff(String(cutoff));
        const listed = (yield* repositories).filter(spec.enabled);
        const position =
          typeof pageCursor === "string"
            ? Option.some(yield* decodeBackfillCursor(pageCursor))
            : Option.none();
        // A repository removed from the installation is skipped.
        const repository = Option.match(position, {
          onNone: () => listed[0],
          onSome: ({ repositoryId }) => listed.find((item) => item.id >= repositoryId),
        });
        if (repository === undefined) return { rows: [], hasMore: false };

        const url = Option.flatMap(position, ({ repositoryId, next }) =>
          repositoryId === repository.id ? Option.fromNullishOr(next) : Option.none(),
        ).pipe(
          Option.getOrElse(() =>
            withParams(repoPath(repository, spec.path), {
              ...spec.params,
              sort: "created",
              direction: "asc",
              per_page: pageSize,
            }),
          ),
        );
        const page = yield* client.get(Schema.Array(spec.itemSchema), url);
        const beforeCutoff = page.body.filter(
          (item) => item.created_at.getTime() <= cutoffDate.getTime(),
        );
        const rows = beforeCutoff
          .filter(spec.keep)
          .map((item) => spec.toRow(item, BigInt(repository.id)));

        if (beforeCutoff.length === page.body.length && Option.isSome(page.next)) {
          return {
            rows,
            nextPageCursor: yield* encodeBackfillCursor({
              repositoryId: repository.id,
              next: page.next.value,
            }),
            hasMore: true,
          };
        }
        const following = listed.find((item) => item.id > repository.id);
        if (following === undefined) return { rows, hasMore: false };
        return {
          rows,
          nextPageCursor: yield* encodeBackfillCursor({ repositoryId: following.id }),
          hasMore: true,
        };
      }),
  });

type ChangesPage<Row> = {
  readonly repository: RepositoryRef;
  readonly rows: ReadonlyArray<Row>;
  readonly next: Option.Option<string>;
};

/**
 * One repository's changes, newest first, so an edit during the read repeats a
 * row instead of skipping one.
 */
const changesPages = <Item extends Timestamps, Row extends object>(
  client: GitHubClientService,
  spec: RepoResourceSpec<Item, Row>,
  repository: RepositoryRef,
  since: Option.Option<Date>,
  url: Option.Option<string>,
): Stream.Stream<ChangesPage<Row>, ConnectorError> => {
  const first = withParams(repoPath(repository, spec.path), {
    ...spec.params,
    sort: "updated",
    direction: "desc",
    per_page: pageSize,
    // Never send an old `since` to mean everything: GitHub then returns nothing.
    ...(spec.since && Option.isSome(since) ? { since: since.value.toISOString() } : {}),
  });
  const isRecent = (item: Item) => isSince(since, item.updated_at);
  return Stream.paginate(
    Option.getOrElse(url, () => first),
    (current) =>
      client.get(Schema.Array(spec.itemSchema), current).pipe(
        Effect.map((page) => {
          const next = page.body.every(isRecent) ? page.next : Option.none();
          const rows = page.body
            .filter((item) => isRecent(item) && spec.keep(item))
            .map((item) => spec.toRow(item, BigInt(repository.id)));
          return [[{ repository, rows, next }], next] as const;
        }),
      ),
  );
};

/**
 * Reads each repository's updates since the last run, up to 20 pages per run.
 * An archived repository is skipped once read after it was archived.
 */
export const changesRepoResource = <Item extends Timestamps, Row extends object>(
  client: GitHubClientService,
  spec: RepoResourceSpec<Item, Row>,
) =>
  Fetch.changes({
    cursor: Cursor.string(),
    interval: changesInterval,
    fetch: ({ cursor }) =>
      Effect.gen(function* () {
        const state = yield* decodeChangesCursor(String(cursor));
        const listed = yield* listRepositories(client, RepositoryRefSchema);
        const pending = state.pending;
        const until = pending?.until ?? (yield* DateTime.now);
        // Only repositories with the feature on count as read. One that turns it on
        // later is read in full, because GitHub keeps the hidden items.
        const repositoryIds =
          pending?.repositoryIds ?? listed.filter(spec.enabled).map((repository) => repository.id);
        const repositories = listed.filter(
          (repository) =>
            spec.enabled(repository) &&
            repositoryIds.includes(repository.id) &&
            repository.id >= (pending?.repositoryId ?? 0) &&
            !(
              repository.archived && !isSince(readFrom(state, repository.id), repository.updated_at)
            ),
        );

        const pages = yield* Stream.fromIterable(repositories).pipe(
          Stream.flatMap((repository) =>
            changesPages(
              client,
              spec,
              repository,
              readFrom(state, repository.id),
              Option.fromNullishOr(
                pending?.repositoryId === repository.id ? pending.url : undefined,
              ),
            ),
          ),
          Stream.take(maxChangesPagesPerRun),
          Stream.runCollect,
        );
        const rows = pages.flatMap((page) => page.rows);

        // Where the next run goes on: the next page, or the next repository.
        const position = Option.flatMap(Arr.last(pages), ({ repository, next }) =>
          Option.match(next, {
            onSome: (url) => Option.some({ repositoryId: repository.id, url }),
            onNone: () =>
              Arr.findFirst(repositories, (item) => item.id > repository.id).pipe(
                Option.map((item) => ({ repositoryId: item.id })),
              ),
          }),
        );
        if (pages.length === maxChangesPagesPerRun && Option.isSome(position)) {
          return {
            rows,
            cursor: yield* encodeChangesCursor({
              ...state,
              pending: { until, repositoryIds, ...position.value },
            }),
            hasMore: true,
          };
        }
        return {
          rows,
          cursor: yield* encodeChangesCursor({ since: until, repositoryIds }),
          hasMore: false,
        };
      }),
  });

export const deleteRow = (id: bigint): Effect.Effect<DeleteRow> =>
  DateTime.nowAsDate.pipe(Effect.map((version): DeleteRow => ({ id, version, _deleted: true })));

export const decodeEvent = <A>(schema: Schema.Decoder<A>, payload: unknown) =>
  Schema.decodeUnknownEffect(schema)(payload).pipe(
    Effect.mapError(
      (cause) => new ConnectorError({ message: "GitHub webhook payload does not decode", cause }),
    ),
  );
