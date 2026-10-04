import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { FileSystemCassetteStore, VcrHttpClient } from "@useairfoil/effect-vcr";
import { ConfigProvider, Effect, Layer, type Schema } from "effect";
import { FetchHttpClient } from "effect/unstable/http";

import {
  CheckoutSchema,
  CustomerSchema,
  DiscountSchema,
  OrderSchema,
  PolarApiClient,
  PolarConnector,
  ProductSchema,
  RefundSchema,
  SubscriptionSchema,
} from "../src/index";

const apiLayer = PolarApiClient.layerConfig(PolarConnector.PolarConfigDef.config).pipe(
  Layer.provide(
    VcrHttpClient.layer({
      vcrName: "producer-polar",
      redact: {
        // The organization ID comes from local config, so keep it out of the cassette.
        requestQueryParams: ["organization_id"],
        responseBodyReplacements: {
          name: "Test Name",
          customer_name: "Test Customer",
          email: "customer@example.com",
          customer_email: "customer@example.com",
          billing_name: "Test Customer",
          public_name: "T",
          invoice_number: "TEST-0001",
          avatar_url: null,
        },
        responseBodyKeys: [
          "client_secret",
          "url",
          "success_url",
          "return_url",
          "customer_ip_address",
          "payment_processor_metadata",
        ],
      },
    }).pipe(
      Layer.provide(FileSystemCassetteStore.layer()),
      Layer.provide(Layer.merge(NodeServices.layer, FetchHttpClient.layer)),
    ),
  ),
  Layer.provide(
    ConfigProvider.layer(
      ConfigProvider.fromUnknown({
        POLAR_API_BASE_URL: "https://sandbox-api.polar.sh/v1/",
        POLAR_WEBHOOK_SECRET: "test-webhook-secret",
      }).pipe(
        ConfigProvider.orElse(ConfigProvider.fromEnv()),
        ConfigProvider.orElse(ConfigProvider.fromUnknown({ POLAR_ACCESS_TOKEN: "test" })),
      ),
    ),
  ),
);

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
    }).pipe(Effect.provide(apiLayer), Effect.scoped),
  );

  it.effect("keeps unit quantities", () =>
    Effect.gen(function* () {
      const api = yield* PolarApiClient.PolarApiClient;
      const page = { page: 1, limit: 100, sorting: "-created_at" };
      const checkouts = yield* api.fetchList(CheckoutSchema, "checkouts/", page);
      const orders = yield* api.fetchList(OrderSchema, "orders/", page);
      const subscriptions = yield* api.fetchList(SubscriptionSchema, "subscriptions/", {
        ...page,
        sorting: "-started_at",
      });

      expect({
        checkouts: checkouts.items.flatMap((item) =>
          item.units === null ? [] : [[item.units, item.min_units, item.max_units]],
        ),
        orders: orders.items.flatMap((item) => (item.units === null ? [] : [item.units])),
        subscriptions: subscriptions.items.flatMap((item) =>
          item.units === null ? [] : [item.units],
        ),
      }).toMatchInlineSnapshot(`
        {
          "checkouts": [
            [
              5,
              null,
              null,
            ],
            [
              4,
              null,
              null,
            ],
            [
              3,
              1,
              10,
            ],
          ],
          "orders": [
            5,
            4,
          ],
          "subscriptions": [
            5,
          ],
        }
      `);
    }).pipe(Effect.provide(apiLayer), Effect.scoped),
  );

  it.effect.each<{
    readonly path: string;
    readonly schema: Schema.Decoder<unknown>;
    readonly sorting: string;
  }>([
    { path: "checkouts/", schema: CheckoutSchema, sorting: "-created_at" },
    { path: "orders/", schema: OrderSchema, sorting: "-created_at" },
    { path: "subscriptions/", schema: SubscriptionSchema, sorting: "-started_at" },
    { path: "refunds/", schema: RefundSchema, sorting: "-created_at" },
    { path: "products/", schema: ProductSchema, sorting: "-created_at" },
    { path: "discounts/", schema: DiscountSchema, sorting: "-created_at" },
  ])("replays $path list page with VCR", ({ path, schema, sorting }) =>
    Effect.gen(function* () {
      const api = yield* PolarApiClient.PolarApiClient;
      const result = yield* api.fetchList(schema, path, { page: 1, limit: 100, sorting });

      expect(result.items.length).toBeGreaterThan(0);
    }).pipe(Effect.provide(apiLayer), Effect.scoped),
  );
});
