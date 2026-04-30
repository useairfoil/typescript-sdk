import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { ConfigProvider, Effect, Exit, Layer } from "effect";
import { HttpClient, HttpClientRequest } from "effect/unstable/http";

import type { VcrConfig, VcrEntry } from "../src/types";

import { buildRequestKey } from "../src/sanitize";
import { layer } from "../src/vcr-http-client";
import { makeFailingClient, makeLiveClient, mockCassetteStoreLayer } from "./helpers";

describe("record mode", () => {
  it.effect("stores a cassette entry", () => {
    const config: VcrConfig = {
      vcrName: "test-vcr",
      cassetteName: "record-basic",
      mode: "record",
    };

    const { layer: storeLayer, cassettes } = mockCassetteStoreLayer();
    const live = makeLiveClient("ok");

    const liveLayer = Layer.succeed(HttpClient.HttpClient)(live);
    const vcrLayer = layer(config).pipe(
      Layer.provide(Layer.mergeAll(storeLayer, liveLayer, NodeServices.layer)),
    );

    return Effect.gen(function* () {
      const client = yield* HttpClient.HttpClient;
      const response = yield* client.get("https://example.com/");
      const text = yield* response.text;

      expect(text).toBe("ok");
      const file = cassettes.get("record-basic.cassette");
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
      cassetteName: "replay-basic",
      mode: "replay",
    };
    const { layer: storeLayer, cassettes } = mockCassetteStoreLayer();
    const client = makeFailingClient();

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

    const liveLayer = Layer.succeed(HttpClient.HttpClient)(client);
    const vcrLayer = layer(config).pipe(
      Layer.provide(Layer.mergeAll(storeLayer, liveLayer, NodeServices.layer)),
    );

    return Effect.gen(function* () {
      const requestKey = yield* buildRequestKey(
        { method: "GET", url: "https://example.com/", headers: {}, body: "" },
        {},
      );
      cassettes.set("replay-basic.cassette", {
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
      cassetteName: "auto-replay",
      mode: "auto",
    };
    const { layer: storeLayer, cassettes } = mockCassetteStoreLayer();
    const client = makeFailingClient();
    const liveLayer = Layer.succeed(HttpClient.HttpClient)(client);
    const vcrLayer = layer(config).pipe(
      Layer.provide(Layer.mergeAll(storeLayer, liveLayer, NodeServices.layer)),
    );

    return Effect.gen(function* () {
      const requestKey = yield* buildRequestKey(
        { method: "GET", url: "https://example.com/", headers: {}, body: "" },
        {},
      );

      cassettes.set("auto-replay.cassette", {
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
      cassetteName: "redact-ignore",
      mode: "record",
      redact: {
        requestHeaders: ["authorization"],
        requestBodyKeys: ["token"],
      },
      matchIgnore: {
        requestBodyKeys: ["timestamp"],
      },
    };
    const { layer: storeLayer, cassettes } = mockCassetteStoreLayer();
    const client = makeLiveClient("ok");

    const request = HttpClientRequest.post("https://example.com/").pipe(
      HttpClientRequest.setHeader("Authorization", "secret"),
      HttpClientRequest.bodyText(
        JSON.stringify({ token: "secret", timestamp: "1", keep: "yes" }),
        "application/json",
      ),
    );

    const liveLayer = Layer.succeed(HttpClient.HttpClient)(client);
    const vcrLayer = layer(config).pipe(
      Layer.provide(Layer.mergeAll(storeLayer, liveLayer, NodeServices.layer)),
    );

    return Effect.gen(function* () {
      const client = yield* HttpClient.HttpClient;
      yield* client.execute(request);

      const file = cassettes.get("redact-ignore.cassette");
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
      cassetteName: "auto-ci-miss",
      mode: "auto",
    };
    const { layer: storeLayer } = mockCassetteStoreLayer();
    const client = makeLiveClient("ok");

    const liveLayer = Layer.succeed(HttpClient.HttpClient)(client);
    const vcrLayer = layer(config).pipe(
      Layer.provide(Layer.mergeAll(storeLayer, liveLayer, NodeServices.layer)),
    );

    return Effect.gen(function* () {
      const client = yield* HttpClient.HttpClient;
      const result = yield* Effect.exit(client.get("https://example.com/"));

      expect(Exit.isFailure(result)).toBe(true);
    }).pipe(
      Effect.provide(
        vcrLayer.pipe(
          Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({ CI: true }))),
        ),
      ),
    );
  });
});

describe("ACK_DISABLE_VCR with vcr name", () => {
  it.effect("bypasses VCR in replay mode when vcrName is disabled", () => {
    const config: VcrConfig = {
      vcrName: "my-test",
      cassetteName: "context-disable",
      mode: "replay",
    };
    const { layer: storeLayer } = mockCassetteStoreLayer();
    const client = makeLiveClient("live-response");

    const liveLayer = Layer.succeed(HttpClient.HttpClient)(client);
    const vcrLayer = layer(config).pipe(
      Layer.provide(Layer.mergeAll(storeLayer, liveLayer, NodeServices.layer)),
    );

    return Effect.gen(function* () {
      const client = yield* HttpClient.HttpClient;
      const response = yield* client.get("https://example.com/");
      const text = yield* response.text;

      expect(text).toBe("live-response");
    }).pipe(
      Effect.provide(
        vcrLayer.pipe(
          Layer.provide(
            ConfigProvider.layer(ConfigProvider.fromUnknown({ ACK_DISABLE_VCR: "my-test" })),
          ),
        ),
      ),
    );
  });

  it.effect("keeps VCR replay behavior when vcrName is not disabled", () => {
    const config: VcrConfig = {
      vcrName: "not-my-test",
      cassetteName: "context-missing",
      mode: "replay",
    };
    const { layer: storeLayer } = mockCassetteStoreLayer();
    const live = makeLiveClient("live-response");

    const liveLayer = Layer.succeed(HttpClient.HttpClient)(live);
    const vcrLayer = layer(config).pipe(
      Layer.provide(Layer.mergeAll(storeLayer, liveLayer, NodeServices.layer)),
    );

    return Effect.gen(function* () {
      const client = yield* HttpClient.HttpClient;
      const result = yield* Effect.exit(client.get("https://example.com/"));

      expect(Exit.isFailure(result)).toBe(true);
    }).pipe(
      Effect.provide(
        vcrLayer.pipe(
          Layer.provide(
            ConfigProvider.layer(ConfigProvider.fromUnknown({ ACK_DISABLE_VCR: "my-test" })),
          ),
        ),
      ),
    );
  });
});

describe("ACK_DISABLE_VCR with '*'", () => {
  it.effect("bypasses VCR in replay mode when vcrName specified", () => {
    const config: VcrConfig = {
      vcrName: "my-test",
      cassetteName: "context-disable",
      mode: "replay",
    };
    const { layer: storeLayer } = mockCassetteStoreLayer();
    const client = makeLiveClient("live-response");

    const liveLayer = Layer.succeed(HttpClient.HttpClient)(client);
    const vcrLayer = layer(config).pipe(
      Layer.provide(Layer.mergeAll(storeLayer, liveLayer, NodeServices.layer)),
    );

    return Effect.gen(function* () {
      const client = yield* HttpClient.HttpClient;
      const response = yield* client.get("https://example.com/");
      const text = yield* response.text;

      expect(text).toBe("live-response");
    }).pipe(
      Effect.provide(
        vcrLayer.pipe(
          Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({ ACK_DISABLE_VCR: "*" }))),
        ),
      ),
    );
  });

  it.effect("bypasses VCR in replay mode when vcrName is undefined", () => {
    const config: VcrConfig = {
      cassetteName: "context-disable",
      mode: "replay",
    };
    const { layer: storeLayer } = mockCassetteStoreLayer();
    const client = makeLiveClient("live-response");

    const liveLayer = Layer.succeed(HttpClient.HttpClient)(client);
    const vcrLayer = layer(config).pipe(
      Layer.provide(Layer.mergeAll(storeLayer, liveLayer, NodeServices.layer)),
    );

    return Effect.gen(function* () {
      const client = yield* HttpClient.HttpClient;
      const response = yield* client.get("https://example.com/");
      const text = yield* response.text;

      expect(text).toBe("live-response");
    }).pipe(
      Effect.provide(
        vcrLayer.pipe(
          Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({ ACK_DISABLE_VCR: "*" }))),
        ),
      ),
    );
  });
});
