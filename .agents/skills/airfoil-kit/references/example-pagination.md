# example-pagination

Every connector with historical data needs a backfill. In this repo, backfill paging should use `Fetch.page(...)` on a `Resource.entity(...)`.

This document is a pattern catalog, not an exhaustive list of API-specific cases. Pick the pattern that matches observed platform behavior and verify it from docs plus recorded traffic.

Source of truth: `packages/connector-kit/src/core/types.ts` and `packages/connector-kit/src/core/builder.ts`.

## Current `Fetch.page` Shape

```ts
type FetchPageResult<Row extends object> = {
  readonly mutations: ReadonlyArray<ResourceMutation<Row>>;
  readonly nextPageCursor?: Cursor.Value;
  readonly hasMore: boolean;
};

type PageFetch<Row extends object, R = never> = {
  readonly pageCursor: Cursor.Definition;
  readonly cutoff: Cursor.Definition;
  readonly fetch: (input: {
    readonly pageCursor?: Cursor.Value;
    readonly cutoff: Cursor.Value;
  }) => Effect.Effect<FetchPageResult<Row>, ConnectorError, R>;
};
```

Important behavior:

- `fetch` receives the previous page cursor and the resource cutoff.
- Return mutations, `nextPageCursor`, and `hasMore`.
- Empty accepted mutation pages can still advance state.
- Backfill ends when `hasMore === false`.

## Baseline Pattern

```ts
const backfill = Fetch.page({
  pageCursor: Cursor.number(),
  cutoff: Cursor.isoDateTime(),
  fetch: ({ pageCursor, cutoff }) =>
    Effect.gen(function* () {
      const page = typeof pageCursor === "number" ? pageCursor : 1;
      const response = yield* api.fetchList(PostSchema, "/posts", {
        page,
        limit: 100,
        updatedBefore: cutoff,
      });

      return {
        mutations: response.items.map(Resource.upsert),
        nextPageCursor: response.hasMore ? page + 1 : page,
        hasMore: response.hasMore,
      };
    }),
});
```

## Page + Limit

Use numeric page cursors.

```ts
fetch: ({ pageCursor }) =>
  Effect.gen(function* () {
    const page = typeof pageCursor === "number" ? pageCursor : 1;
    const response = yield* api.fetchList(Schema, "/things", { page, limit: 100 });

    return {
      mutations: response.items.map(Resource.upsert),
      nextPageCursor: response.hasMore ? page + 1 : page,
      hasMore: response.hasMore,
    };
  });
```

## Cursor Token

Use opaque string cursors for `starting_after`, `next_token`, and similar APIs.

```ts
fetch: ({ pageCursor }) =>
  Effect.gen(function* () {
    const response = yield* api.fetchCursorPage(Schema, {
      starting_after: typeof pageCursor === "string" ? pageCursor : undefined,
      limit: 100,
    });

    const last = response.items.at(-1);
    const next = response.nextToken ?? last?.id;

    return {
      mutations: response.items.map(Resource.upsert),
      nextPageCursor: next,
      hasMore: Boolean(next),
    };
  });
```

## Delete Mutations

Use delete mutations only when the provider gives a durable key and version.

```ts
return {
  mutations: deletedIds.map((id) =>
    Resource.delete({
      key: id,
      version: cutoff.toString(),
    }),
  ),
  nextPageCursor,
  hasMore,
};
```
