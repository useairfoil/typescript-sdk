# example-pagination

Every connector needs a historical backfill. In this repo, backfill paging
should use `makePullStream` from `@useairfoil/connector-kit`.

This document is a pattern catalog, not an exhaustive list of API-specific
cases. Pick the pattern that matches observed platform behavior and verify it
from docs + recorded traffic.

Source of truth: `packages/connector-kit/src/streams/pull-stream.ts`.

## Current `makePullStream` shape

```ts
type PullPage<T> = {
  readonly cursor: Cursor;
  readonly rows: ReadonlyArray<T>;
  readonly hasMore: boolean;
};

type PullStreamOptions<T, R = never> = {
  readonly initialCursor?: Cursor;
  readonly fetchPage: (cursor: Cursor | undefined) => Effect.Effect<PullPage<T>, ConnectorError, R>;
};
```

Important behavior:

- `fetchPage` receives only the previous cursor.
- Return `{ cursor, rows, hasMore }`.
- Empty pages are skipped automatically while `hasMore === true`.
- Stream ends when `hasMore === false` and no rows remain.

## Baseline pattern

```ts
const backfill = makePullStream<Post, TemplateApiClient>({
  initialCursor: 1,
  fetchPage: (cursor) =>
    Effect.gen(function* () {
      const page = typeof cursor === "number" ? cursor : 1;
      const response = yield* api.fetchList(PostSchema, "/posts", {
        page,
        limit: 100,
      });

      return {
        cursor: response.hasMore ? page + 1 : page,
        rows: response.items,
        hasMore: response.hasMore,
      };
    }),
});
```

## Page + limit

Use numeric page cursors.

```ts
fetchPage: (cursor) =>
  Effect.gen(function* () {
    const page = typeof cursor === "number" ? cursor : 1;
    const response = yield* api.fetchList(Schema, "/things", {
      page,
      limit: 100,
    });

    return {
      cursor: response.hasMore ? page + 1 : page,
      rows: response.items,
      hasMore: response.hasMore,
    };
  });
```

## Cursor token (`starting_after`, `next_token`)

Use opaque string cursors.

```ts
fetchPage: (cursor) =>
  Effect.gen(function* () {
    const response = yield* api.fetchCursorPage(Schema, {
      starting_after: typeof cursor === "string" ? cursor : undefined,
      limit: 100,
    });

    const last = response.items.at(-1);
    const next = response.nextToken ?? last?.id;

    return {
      cursor: next ?? cursor ?? "",
      rows: response.items,
      hasMore: Boolean(next),
    };
  });
```

## Link-header pagination

If the API returns `rel="next"`, parse it in `api.ts` and emit it as a cursor.

Important: continuation URLs from link headers may be absolute URLs or
relative paths. Verify which form your API returns. If your HTTP client
preprends a base URL for relative paths, do not apply that transform to
already-absolute continuation URLs.

```ts
fetchPage: (cursor) =>
  Effect.gen(function* () {
    const url =
      typeof cursor === "string" && cursor.length > 0
        ? cursor
        : "/repos/org/repo/issues?per_page=100";

    const { items, nextUrl } = yield* api.fetchListWithLinkHeader(Schema, url);

    return {
      cursor: nextUrl ?? url,
      rows: items,
      hasMore: Boolean(nextUrl),
    };
  });
```

## Offset + limit

```ts
fetchPage: (cursor) =>
  Effect.gen(function* () {
    const offset = typeof cursor === "number" ? cursor : 0;
    const response = yield* api.fetchOffsetPage(Schema, {
      offset,
      limit: 100,
    });

    return {
      cursor: offset + response.items.length,
      rows: response.items,
      hasMore: response.items.length === 100,
    };
  });
```

## Time-window pagination

```ts
fetchPage: (cursor) =>
  Effect.gen(function* () {
    const since = typeof cursor === "string" ? cursor : "1970-01-01T00:00:00Z";

    const response = yield* api.fetchEvents(Schema, { since, limit: 500 });
    const lastTs = response.items.at(-1)?.created_at;

    return {
      cursor: lastTs ?? since,
      rows: response.items,
      hasMore: response.items.length === 500,
    };
  });
```

When timestamps can tie, prefer a cursor that includes a tie-breaker
(timestamp + id), or use entity primary-key dedupe defensively.

## `initialCutoff` with `runConnector`

`runConnector` currently accepts:

```ts
runConnector(connector, {
  initialCutoff?: Cursor,
  webhook?: { ... },
})
```

`initialCutoff` is a single cursor value (for example `new Date()` or an
ISO timestamp string), not a keyed object.

## Practical guidance

- Prefer server-emitted monotonic cursors (`created_at`, `updated_at`, id).
- Keep page sizes bounded.
- Map transport/parsing failures into `ConnectorError`.
- Add retry/backoff around rate-limit responses where needed.
