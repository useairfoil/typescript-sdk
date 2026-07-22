import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { FileSystemCassetteStore, VcrHttpClient } from "@useairfoil/effect-vcr";
import { ConfigProvider, Effect, Layer, Option, Redacted } from "effect";
import { FetchHttpClient, HttpClient, HttpClientResponse } from "effect/unstable/http";

import { CheckoutSchema, CustomerSchema, PolarApiClient, PolarConnector } from "../src/index";

const makeJsonClient = (body: unknown) =>
  HttpClient.make((request) =>
    Effect.succeed(
      HttpClientResponse.fromWeb(
        request,
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    ),
  );

// Tests the PolarApiClient directly using a recorded cassette so no webhook
// is needed to trigger a backfill cutoff. The connector-level backfill flow
// is covered by webhook.test.ts.
describe("producer-polar api (vcr)", () => {
  it.effect("replays customers list page with VCR", () =>
    Effect.gen(function* () {
      const api = yield* PolarApiClient.PolarApiClient;
      const result = yield* api.fetchList(CustomerSchema, "customers/", {
        page: 1,
        limit: 100,
        sorting: "-created_at",
      });

      expect(result.items.length).toBeGreaterThan(0);
      expect(result.pagination.total_count).toBeGreaterThan(0);
      expect(result.items[0]?.version).toBe(result.items[0]?.modified_at);
    }).pipe(
      Effect.provide(
        PolarApiClient.layerConfig(PolarConnector.PolarConfigDef.config).pipe(
          Layer.provide(
            VcrHttpClient.layer({ vcrName: "producer-polar" }).pipe(
              Layer.provide(FileSystemCassetteStore.layer()),
              Layer.provide(Layer.merge(NodeServices.layer, FetchHttpClient.layer)),
            ),
          ),
          Layer.provide(
            ConfigProvider.layer(
              ConfigProvider.fromUnknown({
                POLAR_ACCESS_TOKEN: "test",
                POLAR_API_BASE_URL: "https://sandbox-api.polar.sh/v1/",
                POLAR_WEBHOOK_SECRET: "test-webhook-secret",
              }),
            ),
          ),
        ),
      ),
      Effect.scoped,
    ),
  );

  it.effect("keeps the schema decode cause for telemetry", () =>
    Effect.gen(function* () {
      const providerSecret = "checkout-client-secret";
      const api = yield* PolarApiClient.make({
        accessToken: Redacted.make("test"),
        apiBaseUrl: "https://api.polar.sh/v1/",
        organizationId: Option.none(),
        webhookSecret: Redacted.make("test-webhook-secret"),
      }).pipe(
        Effect.provideService(
          HttpClient.HttpClient,
          makeJsonClient({
            items: [{ client_secret: providerSecret }],
            pagination: { total_count: 1, max_page: 1 },
          }),
        ),
      );

      const error = yield* api
        .fetchList(CheckoutSchema, "checkouts/", { page: 1, limit: 1, sorting: "-created_at" })
        .pipe(Effect.flip);

      expect(error.message).toBe("Polar API response schema decode failed");
      expect(error.cause).toBeDefined();
    }),
  );
});
