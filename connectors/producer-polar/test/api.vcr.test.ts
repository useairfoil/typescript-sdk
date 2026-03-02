import { access } from "node:fs/promises";
import * as Path from "node:path";
import { FetchHttpClient } from "@effect/platform";
import { NodeFileSystem } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import {
  type Batch,
  Publisher,
  runConnector,
  StateStoreInMemory,
} from "@useairfoil/connector-kit";
import {
  CassetteStoreLive,
  VcrHttpClientLayer,
} from "@useairfoil/effect-http-client";
import { ConfigProvider, Deferred, Effect, Layer, Ref } from "effect";
import { PolarConnector, PolarConnectorConfig } from "../src/index";

type Published = {
  readonly name: string;
  readonly batch: Batch<Record<string, unknown>>;
};

const makeTestPublisher = (expected: number) =>
  Effect.gen(function* () {
    const publishedRef = yield* Ref.make<ReadonlyArray<Published>>([]);
    const done = yield* Deferred.make<number, never>();
    const layer = Layer.succeed(Publisher, {
      publish: ({ name, batch }) =>
        Effect.gen(function* () {
          const next = yield* Ref.updateAndGet(publishedRef, (items) => [
            ...items,
            { name, batch },
          ]);
          if (next.length === expected) {
            yield* Deferred.succeed(done, next.length);
          }
          return { success: true };
        }),
    });

    return { publishedRef, done, layer };
  });

describe("producer-polar api (vcr)", () => {
  it.effect("replays backfill with VCR", () => {
    const cassetteDir = Path.join(process.cwd(), "cassettes");
    const cassetteName = "customers-backfill-replay";
    const cassettePath = Path.join(cassetteDir, `${cassetteName}.json`);

    const cassetteLayer = CassetteStoreLive.pipe(
      Layer.provide(NodeFileSystem.layer),
    );
    const vcrLayer = VcrHttpClientLayer({
      cassetteDir,
      cassetteName,
      mode: "auto",
      matchIgnore: {
        requestHeaders: ["authorization"],
      },
      redact: {
        requestHeaders: ["authorization"],
      },
    }).pipe(
      Layer.provide(Layer.mergeAll(FetchHttpClient.layer, cassetteLayer)),
    );
    const accessToken = process.env.POLAR_ACCESS_TOKEN;
    const connectorLayer = PolarConnectorConfig().pipe(Layer.provide(vcrLayer));
    const configProvider = ConfigProvider.fromMap(
      new Map([
        ["POLAR_ACCESS_TOKEN", accessToken ?? "test"],
        ["POLAR_API_BASE_URL", "https://sandbox-api.polar.sh/v1/"],
      ]),
    );

    return Effect.gen(function* () {
      const { publishedRef, done, layer } = yield* makeTestPublisher(1);
      if (!accessToken) {
        const exists = yield* Effect.tryPromise({
          try: () =>
            access(cassettePath)
              .then(() => true)
              .catch(() => false),
          catch: () => false,
        });
        if (!exists) {
          return yield* Effect.fail(
            new Error(
              "missing POLAR_ACCESS_TOKEN for vcr record; run with `POLAR_ACCESS_TOKEN=...` or `bun --env-file=.env`",
            ),
          );
        }
      }
      const { connector } = yield* PolarConnector;

      yield* Effect.forkScoped(
        runConnector(connector, new Date()).pipe(
          Effect.provide(StateStoreInMemory),
          Effect.provide(layer),
        ),
      );

      yield* Deferred.await(done);
      const published = yield* Ref.get(publishedRef);
      expect(published.length).toBe(1);
      expect(published[0]?.name).toBe("customers");
    }).pipe(
      Effect.provide(connectorLayer),
      Effect.withConfigProvider(configProvider),
      Effect.scoped,
    );
  });
});
