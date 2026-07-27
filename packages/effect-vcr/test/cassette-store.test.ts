import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";

import { parseCassette } from "../src/cassette-store";

describe("parseCassette", () => {
  it.effect("decodes a well-formed cassette file", () =>
    Effect.gen(function* () {
      const content = JSON.stringify({
        exports: {
          default: {
            meta: { createdAt: "2026-01-01T00:00:00.000Z", version: "1" },
            entries: {
              key: {
                request: { method: "GET", url: "https://example.com" },
                response: { status: 200, body: "ok" },
              },
            },
          },
        },
      });

      const file = yield* parseCassette(content, "example.cassette");
      expect(file.exports.default?.entries.key?.response.body).toBe("ok");
    }),
  );

  it.effect("fails with a CassetteStoreError on invalid JSON", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(parseCassette("not json", "example.cassette"));
      expect(error._tag).toBe("CassetteStoreError");
      expect(error.message).toBe("Invalid JSON");
    }),
  );

  it.effect("fails with a CassetteStoreError when the cassette shape is invalid", () =>
    Effect.gen(function* () {
      const content = JSON.stringify({
        exports: { default: { meta: {}, entries: "not-a-record" } },
      });

      const error = yield* Effect.flip(parseCassette(content, "example.cassette"));
      expect(error._tag).toBe("CassetteStoreError");
      expect(error.message).toBe("Invalid cassette file format");
    }),
  );
});
