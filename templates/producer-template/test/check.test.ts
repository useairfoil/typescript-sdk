import { describe, expect, it } from "@effect/vitest";
import { ConnectorApp, ConnectorError } from "@useairfoil/connector-kit";
import { ConfigProvider, Effect, Layer, Ref } from "effect";

import type { TemplateApiClientService } from "../src/api";

import { TemplateApiClient, TemplateConnector } from "../src/index";

describe("producer-template configuration checks", () => {
  it.effect("performs a one-item list check", () =>
    Effect.gen(function* () {
      const requests = yield* Ref.make<ReadonlyArray<{ path: string; limit: number }>>([]);
      const api: TemplateApiClientService = {
        fetchJson: () => Effect.fail(new ConnectorError({ message: "Unexpected fetchJson" })),
        fetchList: (_schema, path, options) =>
          Ref.update(requests, (current) => [...current, { path, limit: options.limit }]).pipe(
            Effect.as({ items: [], hasMore: false }),
          ),
      };
      const connectorLayer = Layer.effect(TemplateConnector.TemplateConnector)(
        TemplateConnector.TemplateConfigDef.config.pipe(
          Effect.flatMap(TemplateConnector.make),
          Effect.provideService(TemplateApiClient.TemplateApiClient, api),
        ),
      );

      const result = yield* ConnectorApp.check(
        TemplateConnector.TemplateConnector,
        connectorLayer,
        { resources: ["posts"] },
      );

      expect(result).toEqual({ posts: { _tag: "ok" } });
      expect(yield* Ref.get(requests)).toEqual([{ path: "/posts", limit: 1 }]);
    }).pipe(
      Effect.provide(
        ConfigProvider.layer(
          ConfigProvider.fromUnknown({
            TEMPLATE_API_BASE_URL: "https://example.test",
          }),
        ),
      ),
    ),
  );
});
