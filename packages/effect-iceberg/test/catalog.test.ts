import type { TableMetadata } from "iceberg-js";

import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";

import { IcebergCatalog, IcebergError } from "../src";

const tableMetadata: TableMetadata = {
  "format-version": 2,
  "table-uuid": "table-uuid",
  schemas: [
    {
      type: "struct",
      "schema-id": 0,
      fields: [
        {
          id: 1,
          name: "id",
          type: "string",
          required: true,
        },
      ],
    },
  ],
  "current-schema-id": 0,
  "partition-specs": [{ "spec-id": 0, fields: [] }],
  "default-spec-id": 0,
  "sort-orders": [{ "order-id": 0, fields: [] }],
  "default-sort-order-id": 0,
  properties: {},
};

const jsonResponse = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init?.headers,
    },
  });

const makeFetch = (
  handler: (url: URL, init: RequestInit) => Response | Promise<Response>,
): typeof fetch =>
  ((input, init) => {
    const href = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    return Promise.resolve(handler(new URL(href), init ?? {}));
  }) as typeof fetch;

const provideCatalog = (fetchImpl: typeof fetch) =>
  Effect.provide(IcebergCatalog.layer({ baseUrl: "https://catalog.example", fetch: fetchImpl }));

describe("IcebergCatalog", () => {
  it.effect("lists namespaces through the accessor API", () => {
    const fetch = makeFetch((url, init) => {
      expect(init.method).toBe("GET");
      expect(url.pathname).toBe("/v1/namespaces");
      return jsonResponse({ namespaces: [["analytics"]], "next-page-token": "next" });
    });

    return Effect.gen(function* () {
      const result = yield* IcebergCatalog.listNamespaces();

      expect(result).toEqual({
        namespaces: [{ namespace: ["analytics"] }],
        nextPageToken: "next",
      });
    }).pipe(provideCatalog(fetch));
  });

  it.effect("preserves LoadTableResult etags", () => {
    const fetch = makeFetch((url, init) => {
      expect(init.method).toBe("GET");
      expect(url.pathname).toBe("/v1/namespaces/analytics/tables/events");
      return jsonResponse(
        {
          metadata: tableMetadata,
          "metadata-location": "s3://warehouse/events/metadata.json",
        },
        { headers: { etag: "abc123" } },
      );
    });

    return Effect.gen(function* () {
      const result = yield* IcebergCatalog.loadTableResult({
        namespace: ["analytics"],
        name: "events",
      });

      expect(result?.etag).toBe("abc123");
      expect(result?.metadata).toEqual(tableMetadata);
    }).pipe(provideCatalog(fetch));
  });

  it.effect("returns null when conditional loadTable receives 304", () => {
    const fetch = makeFetch((url, init) => {
      const headers = new Headers(init.headers);

      expect(init.method).toBe("GET");
      expect(url.pathname).toBe("/v1/namespaces/analytics/tables/events");
      expect(headers.get("if-none-match")).toBe("abc123");

      return new Response(null, { status: 304 });
    });

    return Effect.gen(function* () {
      const result = yield* IcebergCatalog.loadTable(
        { namespace: ["analytics"], name: "events" },
        { ifNoneMatch: "abc123" },
      );

      expect(result).toBeNull();
    }).pipe(provideCatalog(fetch));
  });

  it.effect("maps iceberg-js failures into IcebergError", () => {
    const fetch = makeFetch(() =>
      jsonResponse(
        { error: { message: "missing table", type: "NoSuchTableException", code: 404 } },
        { status: 404 },
      ),
    );

    return Effect.gen(function* () {
      const error = yield* IcebergCatalog.loadTable({
        namespace: ["analytics"],
        name: "missing",
      }).pipe(Effect.flip);

      expect(error).toBeInstanceOf(IcebergError.IcebergError);
      expect(error.message).toBe("missing table");
      expect(error.status).toBe(404);
      expect(error.icebergType).toBe("NoSuchTableException");
    }).pipe(provideCatalog(fetch));
  });
});
