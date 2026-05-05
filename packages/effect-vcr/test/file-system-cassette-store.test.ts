import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer } from "effect";
import { FetchHttpClient, HttpClient } from "effect/unstable/http";

import { VcrHttpClient, FileSystemCassetteStore } from "../src/";

describe("FileSystemCassetteStore", () => {
  it.effect("stores cassettes in the __cassettes__ directory by default", () =>
    Effect.gen(function* () {
      const client = yield* HttpClient.HttpClient;
      const response = yield* client.get("https://httpbin.org/robots.txt");
      const text = yield* response.text;
      expect(text.length).toBeGreaterThan(0);
    }).pipe(
      Effect.provide(
        VcrHttpClient.layer().pipe(
          Layer.provide(
            Layer.mergeAll(
              FetchHttpClient.layer,
              NodeServices.layer,
              FileSystemCassetteStore.layer().pipe(Layer.provide(NodeServices.layer)),
            ),
          ),
        ),
      ),
    ),
  );

  it.effect.skip("stores cassettes in the specified directory", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const dir = yield* fs.makeTempDirectoryScoped();

      const files = yield* fs.readDirectory(dir);
      expect(files).toHaveLength(0);

      yield* Effect.gen(function* () {
        const client = yield* HttpClient.HttpClient;
        const response = yield* client.get("https://httpbin.org/robots.txt");
        const text = yield* response.text;
        expect(text.length).toBeGreaterThan(0);
      }).pipe(
        Effect.provide(
          VcrHttpClient.layer().pipe(
            Layer.provide(
              Layer.mergeAll(
                FetchHttpClient.layer,
                NodeServices.layer,
                FileSystemCassetteStore.layer({ cassetteDir: dir }).pipe(
                  Layer.provide(NodeServices.layer),
                ),
              ),
            ),
          ),
        ),
      );

      const filesAfter = yield* fs.readDirectory(dir);
      expect(filesAfter).toStrictEqual(["file-system-cassette-store.test.cassette"]);
    }).pipe(Effect.provide(NodeServices.layer)),
  );
});
