import { describe, expect, it } from "@effect/vitest";
import { Effect, Option, Ref } from "effect";
import { TestClock } from "effect/testing";

import { StripeConnector } from "../src/index";
import { customer, customerWithoutDetails, deletedCustomer } from "./fixtures/customers";
import { event } from "./fixtures/events";
import { type FakeStripe, connectorLayer, makeFakeClient } from "./helpers";

const now = Date.parse("2026-10-03T12:00:00.000Z");

const getCustomers = (fake: FakeStripe) =>
  Effect.gen(function* () {
    const { client, requests } = yield* makeFakeClient(fake);
    const connector = yield* StripeConnector.StripeConnector.pipe(
      Effect.provide(connectorLayer(client)),
    );
    const resource = yield* Effect.fromOption(
      Option.fromNullishOr(connector.resources.find((item) => item.name === "customers")),
    );
    const backfill = yield* Effect.fromOption(Option.fromNullishOr(resource.backfill));
    const feed = yield* Effect.fromOption(Option.fromNullishOr(connector.changes));
    // The feed covers every resource. Tests look at this resource's rows.
    const changes = {
      fetch: (input: { readonly cursor: string }) =>
        feed
          .fetch(input)
          .pipe(Effect.map((result) => ({ ...result, rows: result.rows["customers"] ?? [] }))),
    };
    return { connector, resource, backfill, changes, requests };
  });

describe("customers", () => {
  it.effect("backfills pages created before the cutoff", () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(now);
      const { backfill, requests } = yield* getCustomers({
        list: (_path, params) =>
          params.some(([key]) => key === "starting_after")
            ? { data: [customerWithoutDetails], has_more: false }
            : { data: [customer], has_more: true },
      });
      const cutoff = "2026-10-01T10:30:45.678Z";

      const first = yield* backfill.fetch({ cutoff });
      const second = yield* backfill.fetch({ cutoff, pageCursor: first.nextPageCursor });

      expect({
        requests: yield* Ref.get(requests),
        first: {
          ids: first.rows.map((row) => row.id),
          next: first.nextPageCursor,
          hasMore: first.hasMore,
        },
        second: { ids: second.rows.map((row) => row.id), hasMore: second.hasMore },
      }).toMatchInlineSnapshot(`
        {
          "first": {
            "hasMore": true,
            "ids": [
              "cus_1",
            ],
            "next": "cus_1",
          },
          "requests": [
            "customers?limit=100&created[lte]=1790850645",
            "customers?limit=100&created[lte]=1790850645&starting_after=cus_1",
          ],
          "second": {
            "hasMore": false,
            "ids": [
              "cus_2",
            ],
          },
        }
      `);
      expect(first.rows[0]).toMatchInlineSnapshot(`
        {
          "address": {
            "city": "Berlin",
            "country": "DE",
            "line1": "Teststrasse 1",
            "line2": null,
            "postal_code": "10115",
            "state": null,
          },
          "balance": -500n,
          "created": 2026-01-01T00:00:00.000Z,
          "currency": "eur",
          "delinquent": false,
          "description": null,
          "email": "customer@example.com",
          "id": "cus_1",
          "invoice_prefix": "ABC123",
          "invoice_settings": {
            "default_payment_method": "pm_1",
          },
          "livemode": false,
          "metadata": Map {
            "plan" => "pro",
          },
          "name": "Test Customer",
          "phone": null,
          "shipping": {
            "address": {
              "city": "Berlin",
              "country": "DE",
              "line1": "Teststrasse 1",
              "line2": null,
              "postal_code": "10115",
              "state": null,
            },
            "name": "Test Customer",
            "phone": null,
          },
          "tax_exempt": "none",
          "test_clock": null,
          "version": 2026-10-03T12:00:00.000Z,
        }
      `);
    }),
  );

  it.effect("reads the first changes window from the backfill cutoff", () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(now);
      const { changes, requests } = yield* getCustomers({
        list: () => ({
          data: [event({ id: "evt_1", type: "customer.updated", objectId: "cus_1" })],
          has_more: false,
        }),
        objects: { "customers/cus_1": customer },
      });

      const result = yield* changes.fetch({ cursor: "2026-10-03T11:00:00.000Z" });

      expect({
        requests: yield* Ref.get(requests),
        rows: result.rows.map((row) => ({ id: row.id, version: row.version })),
        cursor: result.cursor,
      }).toMatchInlineSnapshot(`
        {
          "cursor": "{"from":"2026-10-03T11:59:30.000Z"}",
          "requests": [
            "events?limit=100&created[gte]=1791024900&created[lt]=1791028770",
            "customers/cus_1",
          ],
          "rows": [
            {
              "id": "cus_1",
              "version": 2026-10-03T12:00:00.000Z,
            },
          ],
        }
      `);
    }),
  );

  it.effect("skips unrelated events that have no object ID", () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(now);
      const { changes, requests } = yield* getCustomers({
        list: () => ({
          data: [
            // Stripe sends this invoice without an ID.
            {
              ...event({ id: "evt_2", type: "invoice.upcoming", objectId: "" }),
              data: { object: {} },
            },
            event({ id: "evt_1", type: "customer.updated", objectId: "cus_1" }),
          ],
          has_more: false,
        }),
        objects: { "customers/cus_1": customer },
      });

      const result = yield* changes.fetch({ cursor: "2026-10-03T11:00:00.000Z" });

      expect({
        fetched: (yield* Ref.get(requests)).filter((request) => !request.startsWith("events")),
        rows: result.rows.map((row) => row.id),
      }).toMatchInlineSnapshot(`
        {
          "fetched": [
            "customers/cus_1",
          ],
          "rows": [
            "cus_1",
          ],
        }
      `);
    }),
  );

  it.effect("writes a delete row without fetching when an object was deleted", () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(now);
      const { changes, requests } = yield* getCustomers({
        list: () => ({
          data: [
            event({ id: "evt_3", type: "customer.updated", objectId: "cus_2" }),
            event({ id: "evt_2", type: "customer.deleted", objectId: "cus_1" }),
            event({ id: "evt_1", type: "customer.updated", objectId: "cus_1" }),
          ],
          has_more: false,
        }),
        objects: { "customers/cus_2": customerWithoutDetails },
      });

      const result = yield* changes.fetch({ cursor: "2026-10-03T11:00:00.000Z" });

      expect({
        fetched: (yield* Ref.get(requests)).filter((request) => !request.startsWith("events")),
        rows: result.rows,
      }).toMatchInlineSnapshot(`
        {
          "fetched": [
            "customers/cus_2",
          ],
          "rows": [
            {
              "_deleted": true,
              "id": "cus_1",
              "version": 2026-10-03T12:00:00.000Z,
            },
            {
              "address": null,
              "balance": 0n,
              "created": 2026-01-01T00:00:00.000Z,
              "currency": null,
              "delinquent": null,
              "description": null,
              "email": null,
              "id": "cus_2",
              "invoice_prefix": null,
              "invoice_settings": {
                "default_payment_method": null,
              },
              "livemode": false,
              "metadata": Map {},
              "name": null,
              "phone": null,
              "shipping": null,
              "tax_exempt": null,
              "test_clock": null,
              "version": 2026-10-03T12:00:00.000Z,
            },
          ],
        }
      `);
    }),
  );

  it.effect("skips objects that are gone and deletes customers Stripe marks as deleted", () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(now);
      const { changes } = yield* getCustomers({
        list: () => ({
          data: [
            event({ id: "evt_2", type: "customer.updated", objectId: "cus_3" }),
            event({ id: "evt_1", type: "customer.updated", objectId: "cus_404" }),
          ],
          has_more: false,
        }),
        objects: { "customers/cus_3": deletedCustomer },
      });

      const result = yield* changes.fetch({ cursor: "2026-10-03T11:00:00.000Z" });

      expect(result.rows).toMatchInlineSnapshot(`
        [
          {
            "_deleted": true,
            "id": "cus_3",
            "version": 2026-10-03T12:00:00.000Z,
          },
        ]
      `);
    }),
  );

  it.effect("stops after 20 event pages and resumes the same window", () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(now);
      let page = 0;
      const { changes, requests } = yield* getCustomers({
        list: () => {
          const index = ++page;
          return {
            data: [event({ id: `evt_${index}`, type: "customer.updated", objectId: "cus_1" })],
            has_more: true,
          };
        },
        objects: { "customers/cus_1": customer },
      });

      const first = yield* changes.fetch({ cursor: "2026-10-03T11:00:00.000Z" });
      const firstRequests = yield* Ref.get(requests);
      yield* TestClock.adjust("1 hour");
      const second = yield* changes.fetch({ cursor: String(first.cursor) });
      const secondRequests = (yield* Ref.get(requests)).slice(firstRequests.length);

      expect({
        eventPages: firstRequests.filter((request) => request.startsWith("events")).length,
        rows: first.rows.length,
        firstCursor: first.cursor,
        resumedWith: secondRequests[0],
        secondCursor: second.cursor,
      }).toMatchInlineSnapshot(`
        {
          "eventPages": 20,
          "firstCursor": "{"from":"2026-10-03T11:00:00.000Z","end":"2026-10-03T11:59:30.000Z","after":"evt_20"}",
          "resumedWith": "events?limit=100&created[gte]=1791024900&created[lt]=1791028770&starting_after=evt_20",
          "rows": 1,
          "secondCursor": "{"from":"2026-10-03T11:00:00.000Z","end":"2026-10-03T11:59:30.000Z","after":"evt_40"}",
        }
      `);
    }),
  );

  it.effect("fails when Stripe no longer has the events after the cursor", () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(now);
      const { changes } = yield* getCustomers({});

      const error = yield* changes.fetch({ cursor: "2026-09-01T00:00:00.000Z" }).pipe(Effect.flip);

      expect(error.message).toMatchInlineSnapshot(
        `"Stripe no longer has the events after 2026-09-01T00:00:00.000Z. Run a new backfill."`,
      );
    }),
  );
});
