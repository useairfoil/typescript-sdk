import { describe, expect, it } from "@effect/vitest";
import { ConnectorApp } from "@useairfoil/connector-kit";
import { Effect, Option, Ref } from "effect";
import { TestClock } from "effect/testing";

import { HubSpotConnector, manifest } from "../src/index";
import { tableSchemas } from "../src/tables";
import {
  ada,
  archivedCompany,
  crmObject,
  merged,
  owner,
  pipeline,
  properties,
  removedOwner,
} from "./fixtures/objects";
import {
  type FakeHubSpot,
  type FakeRequest,
  connectorLayer,
  makeFakeClient,
  plain,
} from "./helpers";

const now = Date.parse("2026-10-07T12:00:00.000Z");
const cutoff = "2026-10-07T11:50:00.000Z";

type ResourceName = (typeof manifest.resources)[number]["name"];

/** Answers by `METHOD path`. */
const routes =
  (answers: Readonly<Record<string, (request: FakeRequest) => unknown>>): FakeHubSpot =>
  (request) =>
    answers[`${request.method} ${request.path}`]?.(request);

const describeRequest = (request: FakeRequest) =>
  [
    request.method,
    request.path,
    request.params === undefined ? "" : new URLSearchParams(request.params).toString(),
    request.body === undefined ? "" : JSON.stringify(request.body),
  ]
    .filter((part) => part !== "")
    .join(" ");

const getResource = (name: ResourceName, fake: FakeHubSpot) =>
  Effect.gen(function* () {
    yield* TestClock.setTime(now);
    const { client, requests } = yield* makeFakeClient(fake);
    const connector = yield* HubSpotConnector.HubSpotConnector.pipe(
      Effect.provide(connectorLayer(client)),
    );
    const resource = yield* Effect.fromOption(
      Option.fromNullishOr(connector.resources.find((item) => item.name === name)),
    );
    const backfill = yield* Effect.fromOption(Option.fromNullishOr(resource.backfill));
    const changes = yield* Effect.fromOption(Option.fromNullishOr(resource.changes));
    return {
      backfill,
      changes,
      requests: Ref.get(requests).pipe(Effect.map((items) => items.map(describeRequest))),
    };
  });

const contactRoutes = (answers: Readonly<Record<string, (request: FakeRequest) => unknown>>) =>
  routes({
    "GET /crm/properties/2026-09/contacts": () => properties,
    "POST /crm/associations/2026-09/contacts/companies/batch/read": () => ({ results: [] }),
    ...answers,
  });

const cursor = (state: {
  readonly recent?: object;
  readonly delayed?: object;
  readonly refresh?: object;
  readonly archive?: object;
}) =>
  JSON.stringify({
    // Nothing is due unless a test says so.
    recent: { from: "2026-10-07T12:00:00.000Z" },
    delayed: { from: "2026-10-07T12:00:00.000Z" },
    refresh: { last: "2026-10-07T12:00:00.000Z" },
    archive: { last: "2026-10-07T12:00:00.000Z" },
    ...state,
  });

describe("resources", () => {
  it.effect("matches the manifest and the table schemas", () =>
    Effect.gen(function* () {
      const { client } = yield* makeFakeClient(() => undefined);
      const connector = yield* HubSpotConnector.HubSpotConnector.pipe(
        Effect.provide(connectorLayer(client)),
      );

      expect(connector.resources.map((item) => item.name)).toEqual(
        manifest.resources.map((item) => item.name),
      );
      for (const resource of connector.resources) {
        expect(tableSchemas[resource.name]).toBe(resource.rowSchema);
      }
    }),
  );

  it.effect("checks every resource with read-only calls", () =>
    Effect.gen(function* () {
      const { client, requests } = yield* makeFakeClient(() => ({ results: [] }));

      const result = yield* ConnectorApp.check(
        HubSpotConnector.HubSpotConnector,
        connectorLayer(client),
        { resources: manifest.resources.map((resource) => resource.name) },
      );

      expect({
        failed: Object.entries(result).filter(([, item]) => item._tag !== "ok"),
        requests: (yield* Ref.get(requests)).map(describeRequest),
      }).toMatchInlineSnapshot(`
        {
          "failed": [],
          "requests": [
            "GET /crm/objects/2026-09/contacts limit=1",
            "GET /crm/properties/2026-09/contacts",
            "GET /crm/objects/2026-09/companies limit=1",
            "GET /crm/properties/2026-09/companies",
            "GET /crm/objects/2026-09/deals limit=1",
            "GET /crm/properties/2026-09/deals",
            "GET /crm/objects/2026-09/tickets limit=1",
            "GET /crm/properties/2026-09/tickets",
            "GET /crm/objects/2026-09/calls limit=1",
            "GET /crm/properties/2026-09/calls",
            "GET /crm/objects/2026-09/emails limit=1",
            "GET /crm/properties/2026-09/emails",
            "GET /crm/objects/2026-09/meetings limit=1",
            "GET /crm/properties/2026-09/meetings",
            "GET /crm/objects/2026-09/notes limit=1",
            "GET /crm/properties/2026-09/notes",
            "GET /crm/objects/2026-09/tasks limit=1",
            "GET /crm/properties/2026-09/tasks",
            "GET /crm/objects/2026-09/line_items limit=1",
            "GET /crm/properties/2026-09/line_items",
            "GET /crm/objects/2026-09/products limit=1",
            "GET /crm/properties/2026-09/products",
            "GET /crm/owners/2026-09 limit=1",
            "GET /crm/pipelines/2026-09/deals",
            "GET /crm/pipelines/2026-09/tickets",
          ],
        }
      `);
    }),
  );

  it.effect("backfills up to the cutoff, with every page of associations", () =>
    Effect.gen(function* () {
      const late = crmObject("102", {}, { createdAt: "2026-10-07T11:55:00.000Z" });
      const { backfill, requests } = yield* getResource(
        "contacts",
        contactRoutes({
          "GET /crm/objects/2026-09/contacts": () => ({
            results: [ada, late],
            paging: { next: { after: "103" } },
          }),
          "POST /crm/objects/2026-09/contacts/batch/read": () => ({ results: [ada] }),
          "POST /crm/associations/2026-09/contacts/companies/batch/read": (request) =>
            JSON.stringify(request.body).includes("after")
              ? { results: [{ from: { id: "101" }, to: [{ toObjectId: 2 }] }] }
              : {
                  results: [
                    {
                      from: { id: "101" },
                      to: [{ toObjectId: 1 }],
                      paging: { next: { after: "page-2" } },
                    },
                  ],
                },
        }),
      );

      const page = yield* backfill.fetch({ cutoff });

      expect(plain({ page, requests: yield* requests })).toMatchInlineSnapshot(`
        {
          "page": {
            "hasMore": true,
            "nextPageCursor": "103",
            "rows": [
              {
                "_deleted": false,
                "company_ids": [
                  "1",
                  "2",
                ],
                "created_at": "2026-10-06T20:05:18.410Z",
                "id": "101",
                "properties": {
                  "email": "ada@acme.example.com",
                  "firstname": "Ada",
                  "hs_object_id": "101",
                },
                "updated_at": "2026-10-06T20:05:54.562Z",
                "version": "2026-10-07T12:00:00.000Z",
              },
            ],
          },
          "requests": [
            "GET /crm/objects/2026-09/contacts limit=100&properties=hs_object_id",
            "GET /crm/properties/2026-09/contacts",
            "POST /crm/objects/2026-09/contacts/batch/read {"inputs":[{"id":"101"}],"properties":["email","firstname","phone","lastmodifieddate","hs_merged_object_ids"]}",
            "POST /crm/associations/2026-09/contacts/companies/batch/read {"inputs":[{"id":"101"}]}",
            "POST /crm/associations/2026-09/contacts/companies/batch/read {"inputs":[{"id":"101","after":"page-2"}]}",
          ],
        }
      `);
    }),
  );

  it.effect("reads changes from the cutoff and deletes merged IDs", () =>
    Effect.gen(function* () {
      const { changes, requests } = yield* getResource(
        "contacts",
        contactRoutes({
          "POST /crm/objects/2026-09/contacts/search": () => ({
            total: 1,
            results: [{ id: "103", properties: { lastmodifieddate: "2026-10-07T11:58:00.000Z" } }],
          }),
          "POST /crm/objects/2026-09/contacts/batch/read": () => ({ results: [merged] }),
        }),
      );

      const result = yield* changes.fetch({ cursor: cutoff });

      expect(
        plain({ ...result, cursor: JSON.parse(String(result.cursor)), requests: yield* requests }),
      ).toMatchInlineSnapshot(`
        {
          "cursor": {
            "archive": {
              "last": "2026-10-07T11:50:00.000Z",
            },
            "delayed": {
              "from": "2026-10-07T11:50:00.000Z",
            },
            "recent": {
              "from": "2026-10-07T12:00:00.000Z",
            },
            "refresh": {
              "last": "2026-10-07T11:50:00.000Z",
            },
          },
          "hasMore": false,
          "requests": [
            "POST /crm/objects/2026-09/contacts/search {"filterGroups":[{"filters":[{"propertyName":"lastmodifieddate","operator":"BETWEEN","value":"1791373800000","highValue":"1791374400000"}]}],"sorts":[{"propertyName":"lastmodifieddate","direction":"ASCENDING"}],"properties":["lastmodifieddate"],"limit":200}",
            "GET /crm/properties/2026-09/contacts",
            "POST /crm/objects/2026-09/contacts/batch/read {"inputs":[{"id":"103"}],"properties":["email","firstname","phone","lastmodifieddate","hs_merged_object_ids"]}",
            "POST /crm/associations/2026-09/contacts/companies/batch/read {"inputs":[{"id":"103"}]}",
          ],
          "rows": [
            {
              "_deleted": false,
              "company_ids": [],
              "created_at": "2026-10-06T20:05:18.410Z",
              "id": "103",
              "properties": {
                "email": "merge-a@acme.example.com",
                "firstname": "Merge",
                "hs_merged_object_ids": "201;202",
                "hs_object_id": "103",
              },
              "updated_at": "2026-10-06T20:05:54.562Z",
              "version": "2026-10-07T12:00:00.000Z",
            },
            {
              "_deleted": true,
              "id": "201",
              "version": "2026-10-07T12:00:00.000Z",
            },
            {
              "_deleted": true,
              "id": "202",
              "version": "2026-10-07T12:00:00.000Z",
            },
          ],
        }
      `);
    }),
  );

  it.effect("deletes records archived since the last scan", () =>
    Effect.gen(function* () {
      const { changes, requests } = yield* getResource(
        "companies",
        routes({
          "GET /crm/properties/2026-09/companies": () => properties,
          "GET /crm/objects/2026-09/companies": () => ({
            results: [
              archivedCompany("301", "2026-10-07T11:30:00.000Z"),
              archivedCompany("302", "2026-10-06T09:00:00.000Z"),
            ],
          }),
        }),
      );

      const result = yield* changes.fetch({
        cursor: cursor({ archive: { last: "2026-10-07T10:00:00.000Z" } }),
      });

      expect(
        plain({ ...result, cursor: JSON.parse(String(result.cursor)), requests: yield* requests }),
      ).toMatchInlineSnapshot(`
        {
          "cursor": {
            "archive": {
              "last": "2026-10-07T12:00:00.000Z",
            },
            "delayed": {
              "from": "2026-10-07T12:00:00.000Z",
            },
            "recent": {
              "from": "2026-10-07T12:00:00.000Z",
            },
            "refresh": {
              "last": "2026-10-07T12:00:00.000Z",
            },
          },
          "hasMore": false,
          "requests": [
            "GET /crm/objects/2026-09/companies limit=100&properties=hs_object_id&archived=true",
          ],
          "rows": [
            {
              "_deleted": true,
              "id": "301",
              "version": "2026-10-07T12:00:00.000Z",
            },
          ],
        }
      `);
    }),
  );

  it.effect("reads every record again when the refresh is due", () =>
    Effect.gen(function* () {
      const { changes, requests } = yield* getResource(
        "contacts",
        contactRoutes({
          "GET /crm/objects/2026-09/contacts": (request) =>
            request.params?.after === undefined
              ? { results: [ada], paging: { next: { after: "102" } } }
              : { results: [merged] },
          "POST /crm/objects/2026-09/contacts/batch/read": () => ({ results: [ada, merged] }),
        }),
      );

      const result = yield* changes.fetch({
        cursor: cursor({ refresh: { last: "2026-10-06T11:00:00.000Z" } }),
      });

      expect({
        rows: result.rows.map((row) => row.id),
        cursor: JSON.parse(String(result.cursor)),
        hasMore: result.hasMore,
        requests: yield* requests,
      }).toMatchInlineSnapshot(`
        {
          "cursor": {
            "archive": {
              "last": "2026-10-07T12:00:00.000Z",
            },
            "delayed": {
              "from": "2026-10-07T12:00:00.000Z",
            },
            "recent": {
              "from": "2026-10-07T12:00:00.000Z",
            },
            "refresh": {
              "last": "2026-10-07T12:00:00.000Z",
            },
          },
          "hasMore": false,
          "requests": [
            "GET /crm/objects/2026-09/contacts limit=100&properties=hs_object_id",
            "GET /crm/objects/2026-09/contacts limit=100&properties=hs_object_id&after=102",
            "GET /crm/properties/2026-09/contacts",
            "POST /crm/objects/2026-09/contacts/batch/read {"inputs":[{"id":"101"},{"id":"103"}],"properties":["email","firstname","phone","lastmodifieddate","hs_merged_object_ids"]}",
            "POST /crm/associations/2026-09/contacts/companies/batch/read {"inputs":[{"id":"101"},{"id":"103"}]}",
          ],
          "rows": [
            "101",
            "103",
            "201",
            "202",
          ],
        }
      `);
    }),
  );

  it.effect("reads owners, removed ones too", () =>
    Effect.gen(function* () {
      const { backfill } = yield* getResource(
        "owners",
        routes({
          "GET /crm/owners/2026-09": (request) =>
            request.params?.archived === "true"
              ? { results: [removedOwner] }
              : { results: [owner] },
        }),
      );

      expect(plain(yield* backfill.fetch({ cutoff }))).toMatchInlineSnapshot(`
        {
          "hasMore": false,
          "rows": [
            {
              "archived": false,
              "created_at": "2026-10-06T19:39:58.678Z",
              "email": "owner@example.com",
              "first_name": "Jo",
              "id": "100568476",
              "last_name": "Owner",
              "teams": [],
              "type": "PERSON",
              "user_id": "100568476n",
              "user_id_including_inactive": "100568476n",
              "version": "2026-10-07T12:00:00.000Z",
            },
            {
              "archived": true,
              "created_at": "2026-10-06T19:39:58.678Z",
              "id": "100568477",
              "teams": [
                {
                  "id": "55",
                  "name": "Sales",
                  "primary": true,
                },
              ],
              "type": "PERSON",
              "user_id_including_inactive": "100568477n",
              "version": "2026-10-07T12:00:00.000Z",
            },
          ],
        }
      `);
    }),
  );

  it.effect("reads deal and ticket pipelines with the fetch time as version", () =>
    Effect.gen(function* () {
      const { changes } = yield* getResource(
        "pipelines",
        routes({
          "GET /crm/pipelines/2026-09/deals": () => ({
            results: [pipeline("default", { isClosed: "false", probability: "0.2" })],
          }),
          "GET /crm/pipelines/2026-09/tickets": () => ({
            results: [pipeline("0", { isClosed: "false", ticketState: "OPEN" })],
          }),
        }),
      );

      expect(plain(yield* changes.fetch({ cursor: cutoff }))).toMatchInlineSnapshot(`
        {
          "cursor": "2026-10-07T12:00:00.000Z",
          "rows": [
            {
              "archived": false,
              "created_at": "1970-01-01T00:00:00.000Z",
              "display_order": "0n",
              "id": "default",
              "key": "deals:default",
              "label": "Sales Pipeline",
              "object_type": "deals",
              "stages": [
                {
                  "archived": false,
                  "display_order": "0n",
                  "id": "appointmentscheduled",
                  "label": "Appointment Scheduled",
                  "metadata": {
                    "isClosed": "false",
                    "probability": "0.2",
                  },
                },
              ],
              "version": "2026-10-07T12:00:00.000Z",
            },
            {
              "archived": false,
              "created_at": "1970-01-01T00:00:00.000Z",
              "display_order": "0n",
              "id": "0",
              "key": "tickets:0",
              "label": "Sales Pipeline",
              "object_type": "tickets",
              "stages": [
                {
                  "archived": false,
                  "display_order": "0n",
                  "id": "appointmentscheduled",
                  "label": "Appointment Scheduled",
                  "metadata": {
                    "isClosed": "false",
                    "ticketState": "OPEN",
                  },
                },
              ],
              "version": "2026-10-07T12:00:00.000Z",
            },
          ],
        }
      `);
    }),
  );
});
