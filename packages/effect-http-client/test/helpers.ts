import { Effect, Layer } from "effect";
import { HttpClient, HttpClientError, HttpClientResponse } from "effect/unstable/http";

import type { CassetteFile } from "../src/types";

import { CassetteStore, CassetteStoreError, createEmptyCassette } from "../src/cassette-store";

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
      new HttpClientError.HttpClientError({
        reason: new HttpClientError.TransportError({
          request,
          description: "live client should not be called",
        }),
      }),
    ),
  );

export const mockCassetteStoreLayer = () => {
  const cassettes = new Map<string, CassetteFile>();
  const store: CassetteStore = {
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
    save: (path: string, cassette: CassetteFile) => {
      cassettes.set(path, cassette);
      return Effect.void;
    },
    loadOrInit: (path: string) => {
      const existing = cassettes.get(path);
      if (existing) return Effect.succeed(existing);
      return createEmptyCassette().pipe(
        Effect.map((empty) => ({ exports: { default: empty } })),
        Effect.tap((empty) =>
          Effect.sync(() => {
            cassettes.set(path, empty);
          }),
        ),
      );
    },
  };

  return {
    cassettes,
    layer: Layer.succeed(CassetteStore)(store),
  };
};
