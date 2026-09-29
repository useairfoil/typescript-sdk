import { describe, expect, it } from "@effect/vitest";
import { ConnectorApp, ConnectorError } from "@useairfoil/connector-kit";
import { ConfigProvider, Effect, Layer, Ref } from "effect";

import type { PolarApiClientService } from "../src/api";

import { PolarApiClient, PolarConnector } from "../src/index";
import { tableSchemas } from "../src/tables";

describe("producer-polar configuration checks", () => {
  it.effect("checks only the selected provider resources", () =>
    Effect.gen(function* () {
      const paths = yield* Ref.make<ReadonlyArray<string>>([]);
      const api: PolarApiClientService = {
        fetchJson: () => Effect.fail(new ConnectorError({ message: "Unexpected fetchJson" })),
        fetchList: (_schema, path) =>
          Ref.update(paths, (current) => [...current, path]).pipe(
            Effect.andThen(
              Effect.succeed({
                items: [],
                pagination: { total_count: 0, max_page: 1 },
              }),
            ),
          ),
      };
      const connectorLayer = Layer.effect(PolarConnector.PolarConnector)(
        PolarConnector.PolarConfigDef.config.pipe(
          Effect.flatMap(PolarConnector.make),
          Effect.provideService(PolarApiClient.PolarApiClient, api),
        ),
      );

      const result = yield* ConnectorApp.check(PolarConnector.PolarConnector, connectorLayer, {
        resources: ["customers", "orders"],
      });
      const connector = yield* PolarConnector.PolarConnector.pipe(Effect.provide(connectorLayer));

      expect(Object.keys(tableSchemas)).toEqual(
        connector.resources.map((resource) => resource.name),
      );
      for (const resource of connector.resources) {
        expect(tableSchemas[resource.name]).toBe(resource.rowSchema);
      }
      expect({ result, paths: yield* Ref.get(paths) }).toMatchInlineSnapshot(`
        {
          "paths": [
            "customers/",
            "orders/",
          ],
          "result": {
            "customers": {
              "_tag": "ok",
            },
            "orders": {
              "_tag": "ok",
            },
          },
        }
      `);
    }).pipe(
      Effect.provide(
        ConfigProvider.layer(
          ConfigProvider.fromUnknown({
            POLAR_ACCESS_TOKEN: "test-token",
            POLAR_API_BASE_URL: "https://api.polar.sh/v1/",
            POLAR_WEBHOOK_SECRET: "test-webhook-secret",
          }),
        ),
      ),
    ),
  );

  it.effect("uses the supported subscription sort key", () =>
    Effect.gen(function* () {
      const requests = yield* Ref.make<ReadonlyArray<string>>([]);
      const api: PolarApiClientService = {
        fetchJson: () => Effect.fail(new ConnectorError({ message: "Unexpected fetchJson" })),
        fetchList: (_schema, path, options) =>
          Ref.update(requests, (current) => [
            ...current,
            `${path}?sorting=${options.sorting}`,
          ]).pipe(
            Effect.andThen(
              Effect.succeed({ items: [], pagination: { total_count: 0, max_page: 1 } }),
            ),
          ),
      };
      const connectorLayer = Layer.effect(PolarConnector.PolarConnector)(
        PolarConnector.PolarConfigDef.config.pipe(
          Effect.flatMap(PolarConnector.make),
          Effect.provideService(PolarApiClient.PolarApiClient, api),
        ),
      );

      yield* ConnectorApp.check(PolarConnector.PolarConnector, connectorLayer, {
        resources: ["subscriptions"],
      });

      expect(yield* Ref.get(requests)).toMatchInlineSnapshot(`
        [
          "subscriptions/?sorting=-started_at",
        ]
      `);
    }).pipe(
      Effect.provide(
        ConfigProvider.layer(
          ConfigProvider.fromUnknown({
            POLAR_ACCESS_TOKEN: "test-token",
            POLAR_API_BASE_URL: "https://api.polar.sh/v1/",
            POLAR_WEBHOOK_SECRET: "test-webhook-secret",
          }),
        ),
      ),
    ),
  );
});
