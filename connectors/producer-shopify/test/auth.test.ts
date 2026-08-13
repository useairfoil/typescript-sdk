import { describe, expect, it } from "@effect/vitest";
import { Cause, Effect, Exit, Redacted, Ref } from "effect";
import {
  HttpClient,
  HttpClientError,
  HttpClientRequest,
  HttpClientResponse,
} from "effect/unstable/http";

import * as ShopifyApiClient from "../src/api";
import * as ShopifyAuth from "../src/auth";

const clientSecret = "client-secret-that-must-not-leak";
const accessToken = "access-token-that-must-not-leak";

const authConfig = {
  shopDomain: "example.myshopify.com",
  clientId: "test-client-id",
  clientSecret: Redacted.make(clientSecret),
};

const apiConfig = {
  ...authConfig,
  apiVersion: "2026-07",
  responseMaxRetries: 5,
  transportMaxRetries: 5,
  graphqlMaxRetries: 5,
  retryBaseDelayMs: 200,
  graphqlRetryBaseDelayMs: 500,
  retryAfterFallbackSeconds: 1,
  requestTimeoutSeconds: 120,
  webhookSecret: Redacted.make("test-webhook-secret"),
};

const jsonResponse = (request: HttpClientRequest.HttpClientRequest, body: unknown, status = 200) =>
  HttpClientResponse.fromWeb(
    request,
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    }),
  );

const makeAuth = (client: HttpClient.HttpClient) =>
  ShopifyAuth.make(authConfig).pipe(Effect.provideService(HttpClient.HttpClient, client));

describe("Shopify client credentials", () => {
  it.effect("exchanges URL-encoded credentials and returns a redacted token", () =>
    Effect.gen(function* () {
      const requestBody = yield* Ref.make("");
      const client = HttpClient.make((request) =>
        Effect.gen(function* () {
          expect(request.method).toBe("POST");
          expect(new URL(request.url).pathname).toBe("/admin/oauth/access_token");
          if (request.body._tag !== "Uint8Array") {
            return yield* Effect.die(new Error("Expected a URL-encoded request body"));
          }
          yield* Ref.set(requestBody, new TextDecoder().decode(request.body.body));
          return jsonResponse(request, { access_token: accessToken, expires_in: 86_400 });
        }),
      );
      const auth = yield* makeAuth(client);
      const token = yield* auth.get;
      const params = new URLSearchParams(yield* Ref.get(requestBody));

      expect(params.get("grant_type")).toBe("client_credentials");
      expect(params.get("client_id")).toBe(authConfig.clientId);
      expect(params.get("client_secret")).toBe(clientSecret);
      expect(Redacted.value(token)).toBe(accessToken);
      expect(JSON.stringify(token)).not.toContain(accessToken);
    }),
  );

  it.effect("maps known provider errors to safe reasons", () =>
    Effect.gen(function* () {
      const shopNotPermitted = yield* makeAuth(
        HttpClient.make((request) =>
          Effect.succeed(jsonResponse(request, { error: "shop_not_permitted" }, 401)),
        ),
      ).pipe(
        Effect.flatMap((auth) => auth.get),
        Effect.flip,
      );
      const invalidClient = yield* makeAuth(
        HttpClient.make((request) =>
          Effect.succeed(jsonResponse(request, { error: "invalid_client" }, 401)),
        ),
      ).pipe(
        Effect.flatMap((auth) => auth.get),
        Effect.flip,
      );

      expect(shopNotPermitted).toMatchObject({
        reason: "shop_not_permitted",
        message: "The Shopify app and store must belong to the same Shopify organization",
      });
      expect(invalidClient).toMatchObject({
        reason: "invalid_client",
        message: "The Shopify client ID or client secret is invalid",
      });
    }),
  );

  it.effect("maps malformed, unknown, and transport failures to exchange_failed", () =>
    Effect.gen(function* () {
      const malformed = yield* makeAuth(
        HttpClient.make((request) =>
          Effect.succeed(
            HttpClientResponse.fromWeb(
              request,
              new Response("{", {
                status: 200,
                headers: { "content-type": "application/json" },
              }),
            ),
          ),
        ),
      ).pipe(
        Effect.flatMap((auth) => auth.get),
        Effect.flip,
      );
      const unknown = yield* makeAuth(
        HttpClient.make((request) =>
          Effect.succeed(jsonResponse(request, { error: "provider_value" }, 500)),
        ),
      ).pipe(
        Effect.flatMap((auth) => auth.get),
        Effect.flip,
      );
      const transport = yield* makeAuth(
        HttpClient.make((request) =>
          Effect.fail(
            new HttpClientError.HttpClientError({
              reason: new HttpClientError.TransportError({
                request,
                cause: new Error(clientSecret),
              }),
            }),
          ),
        ),
      ).pipe(
        Effect.flatMap((auth) => auth.get),
        Effect.exit,
      );

      expect(malformed.reason).toBe("exchange_failed");
      expect(unknown.reason).toBe("exchange_failed");
      expect(Exit.isFailure(transport)).toBe(true);
      if (Exit.isFailure(transport)) {
        const rendered = Cause.pretty(transport.cause);
        expect(rendered).toContain("Shopify authentication failed");
        expect(rendered).not.toContain(clientSecret);
        expect(rendered).not.toContain(accessToken);
      }
    }),
  );

  it.effect("gets the current cached token for every GraphQL request", () =>
    Effect.gen(function* () {
      const gets = yield* Ref.make(0);
      const headers = yield* Ref.make<ReadonlyArray<string | undefined>>([]);
      const auth: ShopifyAuth.ShopifyAuthService = {
        get: Ref.updateAndGet(gets, (count) => count + 1).pipe(
          Effect.map((count) => Redacted.make(`token-${count}`)),
        ),
        invalidate: Effect.void,
      };
      const client = HttpClient.make((request) =>
        Ref.update(headers, (values) => [
          ...values,
          request.headers["x-shopify-access-token"],
        ]).pipe(
          Effect.as(jsonResponse(request, { data: { shop: { id: "gid://shopify/Shop/1" } } })),
        ),
      );
      const api = yield* ShopifyApiClient.make(apiConfig).pipe(
        Effect.provideService(ShopifyAuth.ShopifyAuth, auth),
        Effect.provideService(HttpClient.HttpClient, client),
      );

      yield* api.checkConnection;
      yield* api.checkConnection;

      expect(yield* Ref.get(headers)).toEqual(["token-1", "token-2"]);
    }),
  );

  it.effect("keeps authentication failures actionable at the connector boundary", () =>
    Effect.gen(function* () {
      const authError = new ShopifyAuth.ShopifyAuthError({
        reason: "invalid_client",
        message: "The Shopify client ID or client secret is invalid",
      });
      const auth: ShopifyAuth.ShopifyAuthService = {
        get: Effect.fail(authError),
        invalidate: Effect.void,
      };
      const client = HttpClient.make(() =>
        Effect.die(new Error("The HTTP client must not run when authentication fails")),
      );
      const api = yield* ShopifyApiClient.make(apiConfig).pipe(
        Effect.provideService(ShopifyAuth.ShopifyAuth, auth),
        Effect.provideService(HttpClient.HttpClient, client),
      );

      const error = yield* api.checkConnection.pipe(Effect.flip);

      expect(error.message).toBe("The Shopify client ID or client secret is invalid");
      expect(error.cause).toBe(authError);
      expect(JSON.stringify(error)).not.toContain(clientSecret);
      expect(JSON.stringify(error)).not.toContain(accessToken);
    }),
  );
});
