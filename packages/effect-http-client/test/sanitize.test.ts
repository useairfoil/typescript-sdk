import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import {
  buildRequestKey,
  redactRequest,
  redactResponse,
  sanitizeRequest,
} from "../src/sanitize";
import type { VcrRequest, VcrResponse } from "../src/types";

describe("sanitize", () => {
  it.effect("normalizes headers and ignores specified keys", () =>
    Effect.sync(() => {
      const request: VcrRequest = {
        method: "GET",
        url: "https://example.com/",
        headers: {
          Authorization: "secret",
          "X-Trace": "123",
        },
        body: JSON.stringify({ token: "secret", keep: "yes" }),
      };

      const sanitized = sanitizeRequest(request, {
        ignoreHeaders: ["authorization"],
        ignoreBodyKeys: ["token"],
      });

      expect(sanitized.headers).toEqual({ "x-trace": "123" });
      expect(sanitized.body).toContain("keep");
      expect(sanitized.body).not.toContain("token");
    }),
  );

  it.effect("builds stable keys across header order", () =>
    Effect.gen(function* () {
      const reqA: VcrRequest = {
        method: "POST",
        url: "https://example.com/",
        headers: { "X-B": "b", "X-A": "a" },
        body: "{}",
      };
      const reqB: VcrRequest = {
        method: "POST",
        url: "https://example.com/",
        headers: { "X-A": "a", "X-B": "b" },
        body: "{}",
      };

      const keyA = yield* buildRequestKey(reqA, {});
      const keyB = yield* buildRequestKey(reqB, {});
      expect(keyA).toBe(keyB);
    }),
  );
});

describe("redact", () => {
  it.effect("removes sensitive fields from request and response", () =>
    Effect.sync(() => {
      const request: VcrRequest = {
        method: "GET",
        url: "https://example.com/",
        headers: { authorization: "secret", keep: "yes" },
        body: JSON.stringify({ token: "secret", keep: "yes" }),
      };
      const response: VcrResponse = {
        status: 200,
        headers: { "set-cookie": "secret", keep: "yes" },
        body: JSON.stringify({ token: "secret", keep: "yes" }),
      };

      const redactedReq = redactRequest(request, {
        redactHeaders: ["authorization"],
        redactBodyKeys: ["token"],
      });
      const redactedRes = redactResponse(response, {
        redactHeaders: ["set-cookie"],
        redactBodyKeys: ["token"],
      });

      expect(redactedReq.headers?.authorization).toBeUndefined();
      expect(redactedReq.body).toContain("keep");
      expect(redactedReq.body).not.toContain("token");
      expect(redactedRes.headers?.["set-cookie"]).toBeUndefined();
      expect(redactedRes.body).toContain("keep");
      expect(redactedRes.body).not.toContain("token");
    }),
  );
});
