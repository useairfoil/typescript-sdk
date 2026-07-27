import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";

import type { VcrRequest, VcrResponse } from "../src/types";

import { buildRequestKey, redactRequest, redactResponse, sanitizeRequest } from "../src/sanitize";

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

  it.effect("ignores URL-encoded body keys", () =>
    Effect.gen(function* () {
      const request = (clientSecret: string): VcrRequest => ({
        method: "POST",
        url: "https://example.com/token",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_secret: clientSecret,
        }).toString(),
      });

      const first = yield* buildRequestKey(request("first-secret"), {
        ignoreBodyKeys: ["client_secret"],
      });
      const second = yield* buildRequestKey(request("second-secret"), {
        ignoreBodyKeys: ["client_secret"],
      });

      expect(first).toBe(second);
      expect(first).not.toContain("first-secret");
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

  it.effect("replaces nested JSON values while removed keys take precedence", () =>
    Effect.sync(() => {
      const response: VcrResponse = {
        status: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          access_token: "real-token",
          nested: { client_secret: "real-secret" },
        }),
      };

      const redacted = redactResponse(response, {
        redactBodyKeys: ["client_secret"],
        bodyReplacements: {
          access_token: "token-placeholder",
          client_secret: "secret-placeholder",
        },
      });

      expect(JSON.parse(redacted.body)).toEqual({
        access_token: "token-placeholder",
        nested: {},
      });
    }),
  );

  it.effect("replaces URL-encoded values and preserves other parameters", () =>
    Effect.sync(() => {
      const request: VcrRequest = {
        method: "POST",
        url: "https://example.com/token",
        headers: {
          "content-length": "100",
          "content-type": "application/x-www-form-urlencoded; charset=utf-8",
        },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: "real-client-id",
          client_secret: "real-secret",
        }).toString(),
      };

      const redacted = redactRequest(request, {
        bodyReplacements: {
          client_id: "client-id-placeholder",
          client_secret: "secret-placeholder",
        },
      });
      const params = new URLSearchParams(redacted.body);

      expect(params.get("grant_type")).toBe("client_credentials");
      expect(params.get("client_id")).toBe("client-id-placeholder");
      expect(params.get("client_secret")).toBe("secret-placeholder");
      expect(redacted.headers?.["content-length"]).toBeUndefined();
    }),
  );

  it.effect("keeps content length when the body is unchanged", () =>
    Effect.sync(() => {
      const request: VcrRequest = {
        method: "POST",
        url: "https://example.com/",
        headers: {
          "content-length": "14",
          "content-type": "application/json",
        },
        body: JSON.stringify({ keep: "yes" }),
      };

      const redacted = redactRequest(request, {
        bodyReplacements: { access_token: "token-placeholder" },
      });

      expect(redacted.body).toBe(request.body);
      expect(redacted.headers?.["content-length"]).toBe("14");
    }),
  );

  it.effect("leaves unsupported body formats unchanged", () =>
    Effect.sync(() => {
      const request: VcrRequest = {
        method: "POST",
        url: "https://example.com/",
        headers: { "content-type": "text/plain" },
        body: "client_secret=not-a-form-body-for-this-content-type",
      };

      const redacted = redactRequest(request, {
        bodyReplacements: { client_secret: "secret-placeholder" },
      });

      expect(redacted.body).toBe(request.body);
    }),
  );

  it.effect("preserves an untouched URL-encoded body byte-for-byte", () =>
    Effect.sync(() => {
      const request: VcrRequest = {
        method: "POST",
        url: "https://example.com/token",
        headers: {
          "content-length": "40",
          "content-type": "application/x-www-form-urlencoded",
        },
        // Mixes "+" and "%20" for spaces; a URLSearchParams round-trip would
        // otherwise canonicalize both to the same encoding.
        body: "grant_type=client_credentials&note=a+b&label=a%20b",
      };

      const redacted = redactRequest(request, {
        bodyReplacements: { access_token: "token-placeholder" },
      });

      expect(redacted.body).toBe(request.body);
      expect(redacted.headers?.["content-length"]).toBe("40");
    }),
  );
});
