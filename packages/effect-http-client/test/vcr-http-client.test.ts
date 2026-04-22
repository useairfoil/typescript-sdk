import { describe, expect, it } from "@effect/vitest";
import { ConfigProvider, Effect, Exit, Layer } from "effect";
import { HttpClient, HttpClientRequest } from "effect/unstable/http";
import { buildRequestKey } from "../src/sanitize";
import type { VcrConfig, VcrEntry } from "../src/types";
import { layer as VcrHttpClientLayer } from "../src/vcr-http-client";
import {
  makeFailingClient,
  makeLiveClient,
  makeStoreLayer,
  pathFor,
} from "./helpers";

describe("record mode", () => {
  it.effect("stores a cassette entry", () => {
    const config: VcrConfig = {
      connectorName: "test-connector",
      cassetteDir: "/tmp/vcr",
      cassetteName: "record-basic.cassette",
      mode: "record",
    };
    const { layer: storeLayer, cassettes } = makeStoreLayer();
    const live = makeLiveClient("ok");

    const liveLayer = Layer.succeed(HttpClient.HttpClient)(live);
    const vcrLayer = VcrHttpClientLayer(config).pipe(
      Layer.provide(Layer.mergeAll(storeLayer, liveLayer)),
    );

    return Effect.gen(function* () {
      const client = yield* HttpClient.HttpClient;
      const response = yield* client.get("https://example.com/");
      const text = yield* response.text;

      expect(text).toBe("ok");
      const file = cassettes.get(pathFor(config));
      const cassette = file?.exports.default;
      expect(cassette).toBeDefined();
      expect(Object.keys(cassette!.entries)).toHaveLength(1);
      const entry = Object.values(cassette!.entries)[0];
      expect(entry.response.body).toBe("ok");
    }).pipe(Effect.provide(vcrLayer));
  });
});

describe("replay mode", () => {
  it.effect("returns stored response without live client", () => {
    const config: VcrConfig = {
      connectorName: "test-connector",
      cassetteDir: "/tmp/vcr",
      cassetteName: "replay-basic.cassette",
      mode: "replay",
    };
    const { layer: storeLayer, cassettes } = makeStoreLayer();
    const live = makeFailingClient();
    const path = pathFor(config);

    const entry: VcrEntry = {
      request: {
        method: "GET",
        url: "https://example.com/",
        headers: {},
        body: "",
      },
      response: {
        status: 200,
        headers: { "content-type": "text/plain" },
        body: "replayed",
      },
    };

    const liveLayer = Layer.succeed(HttpClient.HttpClient)(live);
    const vcrLayer = VcrHttpClientLayer(config).pipe(
      Layer.provide(Layer.mergeAll(storeLayer, liveLayer)),
    );

    return Effect.gen(function* () {
      const requestKey = yield* buildRequestKey(
        { method: "GET", url: "https://example.com/", headers: {}, body: "" },
        {},
      );
      cassettes.set(path, {
        exports: {
          default: {
            meta: { createdAt: "2024-01-01T00:00:00.000Z", version: "1" },
            entries: { [requestKey]: entry },
          },
        },
      });

      const client = yield* HttpClient.HttpClient;
      const response = yield* client.get("https://example.com/");
      const text = yield* response.text;

      expect(text).toBe("replayed");
    }).pipe(Effect.provide(vcrLayer));
  });
});

describe("auto mode", () => {
  it.effect("replays when cassette exists", () => {
    const config: VcrConfig = {
      connectorName: "test-connector",
      cassetteDir: "/tmp/vcr",
      cassetteName: "auto-replay.cassette",
      mode: "auto",
    };
    const { layer: storeLayer, cassettes } = makeStoreLayer();
    const live = makeFailingClient();
    const path = pathFor(config);
    const liveLayer = Layer.succeed(HttpClient.HttpClient)(live);
    const vcrLayer = VcrHttpClientLayer(config).pipe(
      Layer.provide(Layer.mergeAll(storeLayer, liveLayer)),
    );

    return Effect.gen(function* () {
      const requestKey = yield* buildRequestKey(
        { method: "GET", url: "https://example.com/", headers: {}, body: "" },
        {},
      );

      cassettes.set(path, {
        exports: {
          default: {
            meta: { createdAt: "2024-01-01T00:00:00.000Z", version: "1" },
            entries: {
              [requestKey]: {
                request: {
                  method: "GET",
                  url: "https://example.com/",
                  headers: {},
                  body: "",
                },
                response: { status: 200, headers: {}, body: "auto-replay" },
              },
            },
          },
        },
      });

      const client = yield* HttpClient.HttpClient;
      const response = yield* client.get("https://example.com/");
      const text = yield* response.text;

      expect(text).toBe("auto-replay");
    }).pipe(Effect.provide(vcrLayer));
  });
});

describe("record with redaction", () => {
  it.effect("removes sensitive data from stored cassette", () => {
    const config: VcrConfig = {
      connectorName: "test-connector",
      cassetteDir: "/tmp/vcr",
      cassetteName: "redact-ignore.cassette",
      mode: "record",
      redact: {
        requestHeaders: ["authorization"],
        requestBodyKeys: ["token"],
      },
      matchIgnore: {
        requestBodyKeys: ["timestamp"],
      },
    };
    const { layer: storeLayer, cassettes } = makeStoreLayer();
    const live = makeLiveClient("ok");

    const request = HttpClientRequest.post("https://example.com/").pipe(
      HttpClientRequest.setHeader("Authorization", "secret"),
      HttpClientRequest.bodyText(
        JSON.stringify({ token: "secret", timestamp: "1", keep: "yes" }),
        "application/json",
      ),
    );

    const liveLayer = Layer.succeed(HttpClient.HttpClient)(live);
    const vcrLayer = VcrHttpClientLayer(config).pipe(
      Layer.provide(Layer.mergeAll(storeLayer, liveLayer)),
    );

    return Effect.gen(function* () {
      const client = yield* HttpClient.HttpClient;
      yield* client.execute(request);

      const file = cassettes.get(pathFor(config));
      const cassette = file?.exports.default;
      expect(cassette).toBeDefined();
      const entry = Object.values(cassette!.entries)[0];
      expect(entry.request.headers?.authorization).toBeUndefined();
      expect(entry.request.body).toContain("keep");
      expect(entry.request.body).not.toContain("token");
    }).pipe(Effect.provide(vcrLayer));
  });
});

describe("auto mode in CI", () => {
  it.effect("fails when cassette is missing", () => {
    const config: VcrConfig = {
      connectorName: "test-connector",
      cassetteDir: "/tmp/vcr",
      cassetteName: "auto-ci-miss.cassette",
      mode: "auto",
    };
    const { layer: storeLayer } = makeStoreLayer();
    const live = makeLiveClient("ok");

    const liveLayer = Layer.succeed(HttpClient.HttpClient)(live);
    const vcrLayer = VcrHttpClientLayer(config).pipe(
      Layer.provide(Layer.mergeAll(storeLayer, liveLayer)),
    );

    return Effect.gen(function* () {
      const client = yield* HttpClient.HttpClient;
      const result = yield* Effect.exit(client.get("https://example.com/"));

      expect(Exit.isFailure(result)).toBe(true);
    }).pipe(
      Effect.provide(vcrLayer),
      Effect.provideService(
        ConfigProvider.ConfigProvider,
        ConfigProvider.fromUnknown({ CI: true }),
      ),
    );
  });
});

describe("ACK_DISABLE_VCR with connectorName", () => {
  it.effect(
    "bypasses VCR in replay mode when connectorName is disabled",
    () => {
      const config: VcrConfig = {
        connectorName: "producer-polar",
        cassetteDir: "/tmp/vcr",
        cassetteName: "context-disable.cassette",
        mode: "replay",
      };
      const { layer: storeLayer } = makeStoreLayer();
      const live = makeLiveClient("live-response");

      const liveLayer = Layer.succeed(HttpClient.HttpClient)(live);
      const vcrLayer = VcrHttpClientLayer(config).pipe(
        Layer.provide(Layer.mergeAll(storeLayer, liveLayer)),
      );

      return Effect.gen(function* () {
        const client = yield* HttpClient.HttpClient;
        const response = yield* client.get("https://example.com/");
        const text = yield* response.text;

        expect(text).toBe("live-response");
      }).pipe(
        Effect.provide(vcrLayer),
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromUnknown({ ACK_DISABLE_VCR: "producer-polar" }),
        ),
      );
    },
  );

  it.effect(
    "keeps VCR replay behavior when connectorName is not disabled",
    () => {
      const config: VcrConfig = {
        connectorName: "producer-stripe",
        cassetteDir: "/tmp/vcr",
        cassetteName: "context-missing.cassette",
        mode: "replay",
      };
      const { layer: storeLayer } = makeStoreLayer();
      const live = makeLiveClient("live-response");

      const liveLayer = Layer.succeed(HttpClient.HttpClient)(live);
      const vcrLayer = VcrHttpClientLayer(config).pipe(
        Layer.provide(Layer.mergeAll(storeLayer, liveLayer)),
      );

      return Effect.gen(function* () {
        const client = yield* HttpClient.HttpClient;
        const result = yield* Effect.exit(client.get("https://example.com/"));

        expect(Exit.isFailure(result)).toBe(true);
      }).pipe(
        Effect.provide(vcrLayer),
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromUnknown({ ACK_DISABLE_VCR: "producer-polar" }),
        ),
      );
    },
  );
});
