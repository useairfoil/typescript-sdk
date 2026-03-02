import {
  HttpClient,
  HttpClientError,
  HttpClientResponse,
} from "@effect/platform";
import { Effect, Layer } from "effect";
import {
  CassetteStore,
  CassetteStoreError,
  createEmptyCassette,
} from "../src/cassette-store";
import type { VcrCassette, VcrConfig } from "../src/types";

export const makeLiveClient = (body: string, status = 200) =>
  HttpClient.make((request) =>
    Effect.succeed(
      HttpClientResponse.fromWeb(
        request,
        new Response(body, {
          status,
          headers: { "content-type": "text/plain" },
        }),
      ),
    ),
  );

export const makeFailingClient = () =>
  HttpClient.make((request) =>
    Effect.fail(
      new HttpClientError.RequestError({
        request,
        reason: "Transport",
        description: "live client should not be called",
      }),
    ),
  );

export const makeStoreLayer = () => {
  const cassettes = new Map<string, VcrCassette>();
  const store = {
    exists: (path: string) => Effect.succeed(cassettes.has(path)),
    load: (path: string) =>
      cassettes.has(path)
        ? Effect.succeed(cassettes.get(path)!)
        : Effect.fail(
            new CassetteStoreError({
              operation: "load",
              path,
              message: "Missing cassette",
            }),
          ),
    save: (path: string, cassette: VcrCassette) => {
      cassettes.set(path, cassette);
      return Effect.void;
    },
    loadOrInit: (path: string) => {
      const existing = cassettes.get(path);
      if (existing) return Effect.succeed(existing);
      return createEmptyCassette().pipe(
        Effect.tap((empty) => {
          cassettes.set(path, empty);
        }),
      );
    },
  };

  return {
    cassettes,
    layer: Layer.succeed(CassetteStore, store),
  };
};

export const pathFor = (config: VcrConfig) =>
  `${config.cassetteDir}/${config.cassetteName}.json`;
