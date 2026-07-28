import { describe, expect, it } from "@effect/vitest";
import { Config, ConfigProvider, Context, Effect, Layer, Ref, Schema } from "effect";

import * as ConnectorApp from "../src/connector-app";
import { Connector, Resource } from "../src/core";
import { ConnectorError } from "../src/errors";

const RowSchema = Schema.Struct({ id: Schema.String });

const makeConnector = (checks?: {
  readonly products?: Effect.Effect<void, ConnectorError>;
  readonly orders?: Effect.Effect<void, ConnectorError>;
  readonly customers?: Effect.Effect<void, ConnectorError>;
}) =>
  Connector.define({
    name: "test",
    resources: [
      Resource.entity({
        name: "products",
        schema: RowSchema,
        key: "id",
        version: "id",
        check: checks?.products ?? Effect.void,
      }),
      Resource.entity({
        name: "orders",
        schema: RowSchema,
        key: "id",
        version: "id",
        check: checks?.orders ?? Effect.void,
      }),
      Resource.entity({
        name: "customers",
        schema: RowSchema,
        key: "id",
        version: "id",
        check: checks?.customers ?? Effect.void,
      }),
    ],
  });

class ScopedCheckClient extends Context.Service<
  ScopedCheckClient,
  { readonly check: Effect.Effect<void, ConnectorError> }
>()("@useairfoil/connector-kit/test/ScopedCheckClient") {}

class TestConnector extends Context.Service<TestConnector, ReturnType<typeof makeConnector>>()(
  "@useairfoil/connector-kit/test/TestConnector",
) {}

class ScopedConnector extends Context.Service<ScopedConnector, ReturnType<typeof makeConnector>>()(
  "@useairfoil/connector-kit/test/ScopedConnector",
) {}

describe("ConnectorApp.check", () => {
  it.effect("checks only selected resources and returns failures as values", () =>
    Effect.gen(function* () {
      const productsRuns = yield* Ref.make(0);
      const connector = makeConnector({
        products: Ref.update(productsRuns, (runs) => runs + 1),
        orders: Effect.fail(new ConnectorError({ message: "Orders access denied" })),
        customers: Effect.die("unselected check must not run"),
      });

      const result = yield* ConnectorApp.check(
        TestConnector,
        Layer.succeed(TestConnector)(connector),
        { resources: ["products", "orders"] },
      );

      expect(result).toEqual({
        products: { _tag: "ok" },
        orders: { _tag: "error", message: "Orders access denied" },
      });
      expect(yield* Ref.get(productsRuns)).toBe(1);
    }),
  );

  it.effect("returns a connector configuration failure for every selected resource", () => {
    const connectorLayer = Layer.effect(TestConnector)(
      Config.string("API_TOKEN").pipe(Effect.as(makeConnector())),
    );

    return Effect.gen(function* () {
      const result = yield* ConnectorApp.check(TestConnector, connectorLayer, {
        resources: ["products", "customers"],
      });

      expect(result.products._tag).toBe("error");
      expect(result.customers._tag).toBe("error");
      expect(result.products._tag === "error" ? result.products.message : "").toContain(
        "API_TOKEN",
      );
    }).pipe(Effect.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({}))));
  });

  it.effect("returns an empty result without building the connector layer", () =>
    Effect.gen(function* () {
      const evaluated = yield* Ref.make(false);
      const connectorLayer = Layer.effect(TestConnector)(
        Ref.set(evaluated, true).pipe(Effect.as(makeConnector())),
      );
      const result = yield* ConnectorApp.check(TestConnector, connectorLayer, { resources: [] });

      expect(result).toEqual({});
      expect(yield* Ref.get(evaluated)).toBe(false);
    }),
  );

  it.effect("keeps scoped connector dependencies open until checks finish", () =>
    Effect.gen(function* () {
      const released = yield* Ref.make(false);
      const checkedWhileOpen = yield* Ref.make(false);

      const clientLayer = Layer.effect(ScopedCheckClient)(
        Effect.acquireRelease(
          Effect.succeed({
            check: Ref.get(released).pipe(
              Effect.flatMap((isReleased) =>
                isReleased
                  ? Effect.fail(new ConnectorError({ message: "Client was already released" }))
                  : Ref.set(checkedWhileOpen, true),
              ),
            ),
          }),
          () => Ref.set(released, true),
        ),
      );
      const connectorLayer = Layer.effect(ScopedConnector)(
        ScopedCheckClient.pipe(Effect.map((client) => makeConnector({ products: client.check }))),
      ).pipe(Layer.provide(clientLayer));

      const result = yield* ConnectorApp.check(ScopedConnector, connectorLayer, {
        resources: ["products"],
      });

      expect(result).toEqual({ products: { _tag: "ok" } });
      expect(yield* Ref.get(checkedWhileOpen)).toBe(true);
      expect(yield* Ref.get(released)).toBe(true);
    }),
  );

  it.effect("reports unknown runtime resource names", () =>
    Effect.gen(function* () {
      const result = yield* ConnectorApp.check(
        TestConnector,
        Layer.succeed(TestConnector)(makeConnector()),
        {
          // @ts-expect-error simulates an unvalidated name received at runtime
          resources: ["missing"],
        },
      );

      expect(result).toEqual({
        missing: { _tag: "error", message: "Unknown connector resource: missing" },
      });
    }),
  );

  it("preserves selected resource names in CheckResult", () => {
    const checked = ConnectorApp.check(
      TestConnector,
      Layer.succeed(TestConnector)(makeConnector()),
      { resources: ["products"] as const },
    );

    type Result = Effect.Success<typeof checked>;
    const readSelected = (result: Result) => {
      const selected = result.products;
      // @ts-expect-error orders was not selected
      const unselected = result.orders;
      return { selected, unselected };
    };

    expect(readSelected).toBeTypeOf("function");
  });
});
