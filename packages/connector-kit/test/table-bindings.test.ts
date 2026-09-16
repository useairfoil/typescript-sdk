import { describe, expect, it } from "@effect/vitest";
import { ConfigProvider, Effect, Schema } from "effect";

import { Connector, Resource } from "../src/core";
import * as RuntimeConfig from "../src/runtime-config";

const resource = <const Name extends string>(name: Name) =>
  Resource.entity({
    name,
    rowSchema: Schema.Struct({ id: Schema.String }),
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

  it.effect("decodes native table identifiers", () =>
    Effect.gen(function* () {
      const bindings = yield* load(
        JSON.stringify({
          products: { namespace: ["default"], name: "products" },
          orders: { namespace: ["default", "sales"], name: "orders" },
        }),
      );

      expect(bindings.products).toEqual({ namespace: ["default"], name: "products" });
      expect(bindings.orders).toEqual({ namespace: ["default", "sales"], name: "orders" });
    }),
  );

  it.effect("rejects malformed, incomplete, unknown, and unsafe bindings", () =>
    Effect.gen(function* () {
      const cases = [
        ["not-json", "TABLE_BINDINGS_INVALID"],
        [
          JSON.stringify({ products: { namespace: ["default"], name: "products" } }),
          "TABLE_BINDINGS_MISMATCH",
        ],
        [
          JSON.stringify({
            products: { namespace: ["default"], name: "products" },
            orders: { namespace: ["default"], name: "orders" },
            "secret-key": { namespace: ["secret-value"], name: "secret-value" },
          }),
          "TABLE_BINDINGS_MISMATCH",
        ],
        [
          JSON.stringify({
            products: { namespace: ["default"], name: "" },
            orders: { namespace: ["default"], name: "orders" },
          }),
          "TABLE_BINDINGS_INVALID",
        ],
        [
          JSON.stringify({
            products: { namespace: ["default"], name: "products", partition: "tenant-a" },
            orders: { namespace: ["default"], name: "orders" },
          }),
          "TABLE_BINDINGS_INVALID",
        ],
        [
          JSON.stringify({
            products: { namespace: [], name: "products" },
            orders: { namespace: ["default"], name: "orders" },
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
