import { NodeHttpServer } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Ingestion, StateStore } from "@useairfoil/connector-kit";
import { DateTime, Deferred, Effect, Layer, Ref, Schema } from "effect";
import { HttpClient, HttpClientRequest } from "effect/http";
import { TestClock } from "effect/testing";

import { HubSpotConnector, webhookPath } from "../src/index";
import { ada, crmObject, merged, portalId, properties } from "./fixtures/objects";
import {
  type FakeRequest,
  connectorLayer,
  makeFakeClient,
  makeTestIngestor,
  plain,
  sign,
} from "./helpers";

const now = Date.parse("2026-10-07T12:00:00.000Z");
const shownKeys = new Set(["id", "version", "_deleted", "company_ids"]);
const host = "hooks.example.com";
const url = `https://${host}${webhookPath}`;

const records: Readonly<Record<string, unknown>> = {
  "101": ada,
  "103": merged,
  "401": crmObject("401", { hs_note_body: "Customer wants a discount." }),
  "501": crmObject("501", { name: "Acme Test Co" }),
};

const BatchReadBodySchema = Schema.Struct({
  inputs: Schema.Array(Schema.Struct({ id: Schema.String })),
});

const batchIds = (request: FakeRequest) =>
  Schema.decodeUnknownSync(BatchReadBodySchema)(request.body).inputs.map((input) => input.id);

/** Answers webhook reads. Backfill and changes find nothing. */
const fake = (request: FakeRequest): unknown => {
  if (request.path.startsWith("/account-info/")) return { portalId };
  if (request.path.startsWith("/crm/properties/")) return properties;
  if (request.path.endsWith("/batch/read") && request.path.startsWith("/crm/objects/")) {
    return { results: batchIds(request).flatMap((id) => records[id] ?? []) };
  }
  return { results: [] };
};

const event = (fields: Record<string, unknown>) => ({
  eventId: 1,
  subscriptionId: 2,
  portalId,
  appId: 3,
  occurredAt: Date.parse("2026-10-07T11:59:00.000Z"),
  attemptNumber: 0,
  ...fields,
});

/** Posts events to the webhook route and waits for `expected` ingests. */
const post = (
  body: unknown,
  options: { readonly signature?: string; readonly expected?: number } = {},
) =>
  Effect.gen(function* () {
    yield* TestClock.setTime(now);
    const { client } = yield* makeFakeClient(fake);
    const connector = yield* HubSpotConnector.HubSpotConnector.pipe(
      Effect.provide(connectorLayer(client)),
    );
    const expected = options.expected ?? 0;
    const { ingestedRef, done, layer } = yield* makeTestIngestor(expected);
    const cutoff = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));

    return yield* Effect.gen(function* () {
      yield* Effect.forkScoped(
        Ingestion.run(connector, {
          initialCutoff: cutoff,
          webhook: { routes: connector.webhooks ?? [] },
        }),
      );

      const rawBody = JSON.stringify(body);
      const signature =
        options.signature ?? sign({ method: "POST", url, body: rawBody, timestamp: now });
      const http = yield* HttpClient.HttpClient;
      const response = yield* http.execute(
        HttpClientRequest.post(webhookPath).pipe(
          HttpClientRequest.setHeaders({
            "x-forwarded-host": host,
            "x-forwarded-proto": "https",
            "x-hubspot-signature-v3": signature,
            "x-hubspot-request-timestamp": String(now),
          }),
          HttpClientRequest.bodyText(rawBody, "application/json"),
        ),
      );
      if (expected > 0) yield* Deferred.await(done);

      const rows = (yield* Ref.get(ingestedRef))
        .filter((item) => item.source === "webhook")
        .flatMap((item) =>
          item.batch.rows.map((row) => ({
            resource: item.resource,
            // Only the fields the tests are about.
            ...Object.fromEntries(Object.entries(row).filter(([key]) => shownKeys.has(key))),
          })),
        );
      return { status: response.status, rows: plain(rows) };
    }).pipe(
      Effect.provide(Layer.mergeAll(StateStore.layerMemory, layer, NodeHttpServer.layerTest)),
    );
  }).pipe(Effect.scoped);

describe("webhook", () => {
  it.effect("rejects a bad signature", () =>
    Effect.gen(function* () {
      expect(
        yield* post(
          [event({ subscriptionType: "object.creation", objectTypeId: "0-1", objectId: 101 })],
          {
            signature: "bad",
          },
        ),
      ).toMatchInlineSnapshot(`
        {
          "rows": [],
          "status": 401,
        }
      `);
    }),
  );

  it.effect("skips other accounts and other events", () =>
    Effect.gen(function* () {
      expect(
        yield* post([
          event({
            subscriptionType: "object.creation",
            objectTypeId: "0-1",
            objectId: 101,
            portalId: 1,
          }),
          event({ subscriptionType: "object.creation", objectTypeId: "0-999", objectId: 1 }),
          event({ subscriptionType: "conversation.creation", objectId: 1 }),
        ]),
      ).toMatchInlineSnapshot(`
        {
          "rows": [],
          "status": 200,
        }
      `);
    }),
  );

  it.effect(
    "reads created and linked records, deletes at the arrival time, and skips bad events",
    () =>
      Effect.gen(function* () {
        expect(
          yield* post(
            [
              { subscriptionType: "object.creation", portalId: "not a number" },
              event({ subscriptionType: "object.creation", objectTypeId: "0-1", objectId: 101 }),
              event({ subscriptionType: "object.deletion", objectTypeId: "0-46", objectId: 402 }),
              event({ subscriptionType: "contact.privacyDeletion", objectId: 104 }),
              event({
                subscriptionType: "object.associationChange",
                fromObjectTypeId: "0-46",
                fromObjectId: 401,
                toObjectTypeId: "0-2",
                toObjectId: 501,
              }),
            ],
            { expected: 2 },
          ),
        ).toMatchInlineSnapshot(`
        {
          "rows": [
            {
              "_deleted": false,
              "company_ids": [],
              "id": "101",
              "resource": "contacts",
              "version": "2026-10-07T12:00:00.000Z",
            },
            {
              "_deleted": true,
              "id": "104",
              "resource": "contacts",
              "version": "2026-10-07T12:00:00.000Z",
            },
            {
              "_deleted": false,
              "company_ids": [],
              "id": "401",
              "resource": "notes",
              "version": "2026-10-07T12:00:00.000Z",
            },
            {
              "_deleted": true,
              "id": "402",
              "resource": "notes",
              "version": "2026-10-07T12:00:00.000Z",
            },
          ],
          "status": 200,
        }
      `);
      }),
  );

  it.effect("keeps a record that still reads, so a late delete can't hide a restore", () =>
    Effect.gen(function* () {
      expect(
        yield* post(
          [event({ subscriptionType: "object.deletion", objectTypeId: "0-1", objectId: 101 })],
          { expected: 1 },
        ),
      ).toMatchInlineSnapshot(`
        {
          "rows": [
            {
              "_deleted": false,
              "company_ids": [],
              "id": "101",
              "resource": "contacts",
              "version": "2026-10-07T12:00:00.000Z",
            },
          ],
          "status": 200,
        }
      `);
    }),
  );

  it.effect("deletes merged records and reads the one they became", () =>
    Effect.gen(function* () {
      expect(
        yield* post(
          [
            event({
              subscriptionType: "object.merge",
              objectTypeId: "0-1",
              objectId: 201,
              primaryObjectId: 201,
              newObjectId: 103,
              mergedObjectIds: [202, 201],
            }),
          ],
          { expected: 1 },
        ),
      ).toMatchInlineSnapshot(`
        {
          "rows": [
            {
              "_deleted": false,
              "company_ids": [],
              "id": "103",
              "resource": "contacts",
              "version": "2026-10-07T12:00:00.000Z",
            },
            {
              "_deleted": true,
              "id": "202",
              "resource": "contacts",
              "version": "2026-10-07T12:00:00.000Z",
            },
            {
              "_deleted": true,
              "id": "201",
              "resource": "contacts",
              "version": "2026-10-07T12:00:00.000Z",
            },
          ],
          "status": 200,
        }
      `);
    }),
  );
});
