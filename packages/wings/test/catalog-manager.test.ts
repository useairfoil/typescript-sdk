import { describe, expect, it } from "@effect/vitest";
import { TestWings } from "@useairfoil/wings-testing";
import { Effect } from "effect";
import { FetchHttpClient } from "effect/unstable/http";

import { CatalogManager } from "../src";

describe("CatalogManager", () => {
  it.effect(
    "manages a catalog and exposes its Iceberg REST client",
    () =>
      Effect.gen(function* () {
        const wings = yield* TestWings.Instance;
        const uri = yield* wings.uri;
        const icebergRestUri = yield* wings.icebergRestUri;
        const manager = yield* CatalogManager.make({ baseUrl: uri });
        const request = {
          id: "integration-test",
          rest: {
            uri: icebergRestUri,
            warehouse: "s3://default-catalog",
            properties: { scope: "integration" },
          },
        };

        const created = yield* manager.createCatalog(request);
        expect(created).toMatchInlineSnapshot(
          {
            rest: { uri: expect.any(String) },
          },
          `
          {
            "name": "catalogs/integration-test",
            "rest": {
              "properties": {
                "scope": "integration",
              },
              "uri": Any<String>,
              "warehouse": "s3://default-catalog",
            },
          }
        `,
        );

        const catalog = yield* manager.getCatalog(request.id);
        expect(catalog).toMatchInlineSnapshot(
          {
            rest: { uri: expect.any(String) },
          },
          `
          {
            "name": "catalogs/integration-test",
            "rest": {
              "properties": {
                "scope": "integration",
              },
              "uri": Any<String>,
              "warehouse": "s3://default-catalog",
            },
          }
        `,
        );

        const iceberg = yield* manager.getIcebergCatalog(request.id);
        const config = yield* iceberg.loadConfig();
        expect(config).toMatchInlineSnapshot(`
          {
            "defaults": {
              "warehouse": "s3://default-catalog",
            },
            "overrides": {
              "prefix": "default-catalog",
            },
          }
        `);

        yield* manager.deleteCatalog(request.id);

        const error = yield* Effect.flip(manager.getCatalog(request.id));
        expect(error.status).toBe(404);
      }).pipe(
        Effect.provide(FetchHttpClient.layer),
        Effect.provide(TestWings.container),
        Effect.scoped,
      ),
    { timeout: 120_000 },
  );
});
