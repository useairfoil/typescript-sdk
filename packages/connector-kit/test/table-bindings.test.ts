import { describe, expect, it } from "@effect/vitest";
import { ConfigProvider, Effect } from "effect";

import { Connector, Resource } from "../src/core";
import * as RuntimeConfig from "../src/runtime-config";

const resource = (name: string) =>
  Resource.entity({
    name,
    schema: { ast: {} } as never,
    key: "id" as never,
    version: "updatedAt" as never,
    check: Effect.void,
  });

const connector = Connector.define({
  name: "test",
  resources: [resource("products"), resource("orders")],
});

const load = (bindings: string) =>
  RuntimeConfig.loadTableBindings(connector).pipe(
    Effect.provide(
      ConfigProvider.layer(
        ConfigProvider.fromUnknown({
          [RuntimeConfig.PlatformRuntimeKey.tableBindings]: bindings,
        }),
      ),
    ),
  );

describe("hosted table bindings", () => {
  it.effect("reports a missing hosted binding document with a stable code", () =>
    RuntimeConfig.loadTableBindings(connector).pipe(
      Effect.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({}))),
      Effect.flip,
      Effect.map((error) => expect(error.code).toBe("TABLE_BINDINGS_MISSING")),
    ),
  );

  it.effect("decodes string and partitioned object bindings", () =>
    Effect.gen(function* () {
      const bindings = yield* load(
        JSON.stringify({
          products: "namespaces/default/tables/products",
          orders: {
            name: "namespaces/default/tables/orders",
            partition: { type: "string", value: "tenant-a" },
          },
        }),
      );

      expect(bindings.products).toEqual({ name: "namespaces/default/tables/products" });
      expect(bindings.orders?.name).toBe("namespaces/default/tables/orders");
      expect(bindings.orders?.partitionValue?.value).toEqual({
        $case: "string",
        string: "tenant-a",
      });
    }),
  );

  it.effect("rejects malformed, incomplete, unknown, and unsafe bindings", () =>
    Effect.gen(function* () {
      const cases = [
        ["not-json", "TABLE_BINDINGS_INVALID"],
        ['{"products":"table-a","products":"table-b","orders":"table"}', "TABLE_BINDINGS_INVALID"],
        [JSON.stringify({ products: "table" }), "TABLE_BINDINGS_MISMATCH"],
        [
          JSON.stringify({ products: "table", orders: "table", "secret-key": "secret-value" }),
          "TABLE_BINDINGS_MISMATCH",
        ],
        [JSON.stringify({ products: "", orders: "table" }), "TABLE_BINDINGS_INVALID"],
        [
          JSON.stringify({
            products: { name: "table", partition: { type: "bytes", value: "not-base64" } },
            orders: "table",
          }),
          "TABLE_BINDINGS_INVALID",
        ],
      ] as const;

      for (const [input, code] of cases) {
        const error = yield* load(input).pipe(Effect.flip);
        expect(error.code).toBe(code);
        expect(error.message).not.toContain("secret-key");
        expect(error.message).not.toContain("secret-value");
        expect(error.message).not.toContain("not-base64");
      }
    }),
  );
});
