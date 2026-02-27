import { HttpClient, HttpClientRequest } from "@effect/platform";
import { expect, it } from "@effect/vitest";
import { ConfigProvider, Effect, Exit, Layer } from "effect";
import { describe } from "vitest";
import { buildRequestKey } from "../sanitize";
import type { VcrConfig, VcrEntry } from "../types";
import { layer as VcrHttpClientLayer } from "../vcr-http-client";
import {
  makeFailingClient,
  makeLiveClient,
  makeStoreLayer,
  pathFor,
} from "./helpers";

describe("record mode", () => {
  it.effect("stores a cassette entry", () => {
    const config: VcrConfig = {
      cassetteDir: "/tmp/vcr",
      cassetteName: "record-basic",
      mode: "record",
    };
    const { layer: storeLayer, cassettes } = makeStoreLayer();
    const live = makeLiveClient("ok");

    const liveLayer = Layer.succeed(HttpClient.HttpClient, live);
    const vcrLayer = VcrHttpClientLayer(config).pipe(
      Layer.provide(Layer.mergeAll(storeLayer, liveLayer)),
    );

    return Effect.gen(function* () {
      const client = yield* HttpClient.HttpClient;
      const response = yield* client.get("https://example.com/");
      const text = yield* response.text;

      expect(text).toBe("ok");
      const cassette = cassettes.get(pathFor(config));
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
      cassetteDir: "/tmp/vcr",
      cassetteName: "replay-basic",
      mode: "replay",
    };
    const { layer: storeLayer, cassettes } = makeStoreLayer();
    const live = makeFailingClient();
    const path = pathFor(config);
    const requestKey = buildRequestKey(
      { method: "GET", url: "https://example.com/", headers: {}, body: "" },
      {},
    );

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

    cassettes.set(path, {
      meta: { createdAt: new Date().toISOString(), version: "1" },
      entries: { [requestKey]: entry },
    });

    const liveLayer = Layer.succeed(HttpClient.HttpClient, live);
    const vcrLayer = VcrHttpClientLayer(config).pipe(
      Layer.provide(Layer.mergeAll(storeLayer, liveLayer)),
    );

    return Effect.gen(function* () {
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
      cassetteDir: "/tmp/vcr",
      cassetteName: "auto-replay",
      mode: "auto",
    };
    const { layer: storeLayer, cassettes } = makeStoreLayer();
    const live = makeFailingClient();
    const path = pathFor(config);
    const requestKey = buildRequestKey(
      { method: "GET", url: "https://example.com/", headers: {}, body: "" },
      {},
    );

    cassettes.set(path, {
      meta: { createdAt: new Date().toISOString(), version: "1" },
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
    });

    const liveLayer = Layer.succeed(HttpClient.HttpClient, live);
    const vcrLayer = VcrHttpClientLayer(config).pipe(
      Layer.provide(Layer.mergeAll(storeLayer, liveLayer)),
    );

    return Effect.gen(function* () {
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
      cassetteDir: "/tmp/vcr",
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
    const { layer: storeLayer, cassettes } = makeStoreLayer();
    const live = makeLiveClient("ok");

    const request = HttpClientRequest.post("https://example.com/").pipe(
      HttpClientRequest.setHeader("Authorization", "secret"),
      HttpClientRequest.bodyText(
        JSON.stringify({ token: "secret", timestamp: "1", keep: "yes" }),
        "application/json",
      ),
    );

    const liveLayer = Layer.succeed(HttpClient.HttpClient, live);
    const vcrLayer = VcrHttpClientLayer(config).pipe(
      Layer.provide(Layer.mergeAll(storeLayer, liveLayer)),
    );

    return Effect.gen(function* () {
      const client = yield* HttpClient.HttpClient;
      yield* client.execute(request);

      const cassette = cassettes.get(pathFor(config));
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
      cassetteDir: "/tmp/vcr",
      cassetteName: "auto-ci-miss",
      mode: "auto",
    };
    const { layer: storeLayer } = makeStoreLayer();
    const live = makeLiveClient("ok");

    const liveLayer = Layer.succeed(HttpClient.HttpClient, live);
    const vcrLayer = VcrHttpClientLayer(config).pipe(
      Layer.provide(Layer.mergeAll(storeLayer, liveLayer)),
    );

    return Effect.gen(function* () {
      const client = yield* HttpClient.HttpClient;
      const result = yield* Effect.exit(client.get("https://example.com/"));

      expect(Exit.isFailure(result)).toBe(true);
    }).pipe(
      Effect.provide(vcrLayer),
      Effect.withConfigProvider(
        ConfigProvider.fromMap(new Map([["CI", "true"]])),
      ),
    );
  });
});
