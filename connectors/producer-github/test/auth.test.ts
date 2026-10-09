import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer, Redacted, Ref } from "effect";
import { HttpClient, HttpClientResponse } from "effect/http";
import { TestClock } from "effect/testing";
import { generateKeyPairSync, verify } from "node:crypto";

import { GitHubAuth } from "../src/index";

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
});
// GitHub hands out PKCS#1 keys. Env files often keep them on one line.
const pem = privateKey.export({ type: "pkcs1", format: "pem" }).toString();
const oneLinePem = pem.trim().replace(/\n/g, "\\n");

const now = Date.parse("2026-10-06T10:00:00.000Z");

const decodePart = (part: string | undefined): unknown =>
  JSON.parse(Buffer.from(part ?? "", "base64url").toString());

describe("auth", () => {
  it.effect("signs an RS256 app JWT from a one-line PEM", () =>
    Effect.gen(function* () {
      const jwt = yield* GitHubAuth.makeAppJwt({
        clientId: "Iv23liTest",
        privateKey: oneLinePem,
        nowMillis: now,
      });
      const [header, claims, signature] = jwt.split(".");

      expect({
        header: decodePart(header),
        claims: decodePart(claims),
        verified: verify(
          "sha256",
          Buffer.from(`${header}.${claims}`),
          publicKey,
          Buffer.from(signature ?? "", "base64url"),
        ),
      }).toMatchInlineSnapshot(`
        {
          "claims": {
            "exp": 1791281340,
            "iat": 1791280740,
            "iss": "Iv23liTest",
          },
          "header": {
            "alg": "RS256",
            "typ": "JWT",
          },
          "verified": true,
        }
      `);
    }),
  );

  it.effect("exchanges the JWT for an installation token and caches it", () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(now);
      const requests = yield* Ref.make<ReadonlyArray<string>>([]);
      const http = HttpClient.make((request) =>
        Ref.update(requests, (current) => [
          ...current,
          `${request.method} ${request.url} ${request.headers["x-github-api-version"]} ${
            request.headers.authorization?.startsWith("Bearer ey") ? "jwt" : "other"
          }`,
        ]).pipe(
          Effect.as(
            HttpClientResponse.fromWeb(
              request,
              new Response(
                JSON.stringify({
                  token: "ghs_test",
                  expires_at: "2026-10-06T11:00:00Z",
                  permissions: { issues: "read" },
                  repository_selection: "all",
                }),
                {
                  status: 201,
                  headers: { "content-type": "application/json" },
                },
              ),
            ),
          ),
        ),
      );

      const tokens = yield* Effect.gen(function* () {
        const auth = yield* GitHubAuth.GitHubAuth;
        const first = yield* auth.get;
        const second = yield* auth.get;
        return [Redacted.value(first), Redacted.value(second)];
      }).pipe(
        Effect.provide(
          GitHubAuth.layer({
            appClientId: "Iv23liTest",
            appPrivateKey: Redacted.make(pem),
            installationId: 42,
          }).pipe(Layer.provide(Layer.succeed(HttpClient.HttpClient)(http))),
        ),
      );

      expect({ tokens, requests: yield* Ref.get(requests) }).toMatchInlineSnapshot(`
        {
          "requests": [
            "POST https://api.github.com/app/installations/42/access_tokens 2026-03-10 jwt",
          ],
          "tokens": [
            "ghs_test",
            "ghs_test",
          ],
        }
      `);
    }),
  );
});
