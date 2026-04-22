import { describe, expect, it } from "@effect/vitest";
import { Effect, flow } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/unstable/http";

import { TestWings } from "../src";

describe("WingsContainer", () => {
  it.effect(
    "should start Wings container successfully",
    () =>
      Effect.gen(function* () {
        const container = yield* TestWings.Instance;
        const grpcHost = yield* container.grpcHostAndPort;
        const httpHost = yield* container.httpHostAndPort;

        const baseClient = yield* HttpClient.HttpClient;
        const client = baseClient.pipe(
          HttpClient.mapRequest(flow(HttpClientRequest.prependUrl(`http://${httpHost}`))),
        );

        const response = yield* client.head("/");

        expect(grpcHost).toBeTruthy();
        expect(httpHost).toBeTruthy();
        expect(response.status).toBe(404);
      }).pipe(
        Effect.provide(TestWings.container),
        Effect.provide(FetchHttpClient.layer),
        Effect.scoped,
      ),
    { timeout: 60_000 },
  );
});
