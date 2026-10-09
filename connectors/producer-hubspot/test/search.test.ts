import { describe, expect, it } from "@effect/vitest";
import { DateTime, Duration, Effect, Ref } from "effect";

import { searchStep, startPass } from "../src/resources/crm/search";
import { CompanySchema } from "../src/schemas/crm";
import { makeFakeClient } from "./helpers";

const spec = {
  name: "companies",
  lastModified: "hs_lastmodifieddate",
  associations: [],
  listsDeleted: true,
  refreshInterval: Duration.days(1),
  rowSchema: CompanySchema,
};

const time = (iso: string) => DateTime.makeUnsafe(iso);
const from = time("2026-10-07T10:00:00.000Z");
const until = time("2026-10-07T11:00:00.000Z");

const hit = (id: string, modified: string) => ({
  id,
  properties: { hs_lastmodifieddate: modified },
});

/** Runs one step against a single search response. */
const step = (pass: Parameters<typeof searchStep>[2], response: unknown) =>
  Effect.gen(function* () {
    const { client, requests } = yield* makeFakeClient(() => response);
    const result = yield* searchStep(client, spec, pass);
    const [request] = yield* Ref.get(requests);
    return {
      ids: result.ids,
      pass: JSON.parse(JSON.stringify(result.pass)),
      body: request?.body,
    };
  });

describe("search", () => {
  it("starts a pass once now minus the lag is past its start", () => {
    const now = time("2026-10-07T11:30:00.000Z");
    expect({
      recent: startPass({ from }, now, Duration.zero),
      delayedTooSoon: startPass({ from }, now, Duration.hours(2)),
    }).toMatchInlineSnapshot(`
      {
        "delayedTooSoon": {
          "from": "2026-10-07T10:00:00.000Z",
        },
        "recent": {
          "from": "2026-10-07T10:00:00.000Z",
          "until": "2026-10-07T11:30:00.000Z",
        },
      }
    `);
  });

  it.effect("reads a window oldest first and ends at its upper bound", () =>
    Effect.gen(function* () {
      expect(yield* step({ from, until }, { results: [hit("1", "2026-10-07T10:30:00.000Z")] }))
        .toMatchInlineSnapshot(`
        {
          "body": {
            "filterGroups": [
              {
                "filters": [
                  {
                    "highValue": "1791370800000",
                    "operator": "BETWEEN",
                    "propertyName": "hs_lastmodifieddate",
                    "value": "1791367200000",
                  },
                ],
              },
            ],
            "limit": 200,
            "properties": [
              "hs_lastmodifieddate",
            ],
            "sorts": [
              {
                "direction": "ASCENDING",
                "propertyName": "hs_lastmodifieddate",
              },
            ],
          },
          "ids": [
            "1",
          ],
          "pass": {
            "from": "2026-10-07T11:00:00.000Z",
          },
        }
      `);
    }),
  );

  it.effect("starts the next page at the last row's time", () =>
    Effect.gen(function* () {
      const next = yield* step(
        { from, until },
        {
          results: [hit("1", "2026-10-07T10:20:00.000Z"), hit("2", "2026-10-07T10:40:00.000Z")],
          paging: { next: { after: "200" } },
        },
      );
      expect(next.pass).toMatchInlineSnapshot(`
        {
          "from": "2026-10-07T10:40:00.000Z",
          "until": "2026-10-07T11:00:00.000Z",
        }
      `);
    }),
  );

  it.effect("reads by ID when a whole page shares one time", () =>
    Effect.gen(function* () {
      const tied = yield* step(
        { from, until },
        { results: [hit("1", "2026-10-07T10:00:00.000Z")], paging: { next: { after: "200" } } },
      );
      const byId = yield* step(
        { from, until, tie: {} },
        { results: [hit("7", "2026-10-07T10:00:00.000Z")], paging: { next: { after: "200" } } },
      );
      const lastPage = yield* step(
        { from, until, tie: { afterId: "7" } },
        { results: [hit("9", "2026-10-07T10:00:00.000Z")] },
      );

      expect({ tied: tied.pass, byId, lastPage }).toMatchInlineSnapshot(`
        {
          "byId": {
            "body": {
              "filterGroups": [
                {
                  "filters": [
                    {
                      "operator": "EQ",
                      "propertyName": "hs_lastmodifieddate",
                      "value": "1791367200000",
                    },
                  ],
                },
              ],
              "limit": 200,
              "properties": [
                "hs_lastmodifieddate",
              ],
              "sorts": [
                {
                  "direction": "ASCENDING",
                  "propertyName": "hs_object_id",
                },
              ],
            },
            "ids": [
              "7",
            ],
            "pass": {
              "from": "2026-10-07T10:00:00.000Z",
              "tie": {
                "afterId": "7",
              },
              "until": "2026-10-07T11:00:00.000Z",
            },
          },
          "lastPage": {
            "body": {
              "filterGroups": [
                {
                  "filters": [
                    {
                      "operator": "EQ",
                      "propertyName": "hs_lastmodifieddate",
                      "value": "1791367200000",
                    },
                    {
                      "operator": "GT",
                      "propertyName": "hs_object_id",
                      "value": "7",
                    },
                  ],
                },
              ],
              "limit": 200,
              "properties": [
                "hs_lastmodifieddate",
              ],
              "sorts": [
                {
                  "direction": "ASCENDING",
                  "propertyName": "hs_object_id",
                },
              ],
            },
            "ids": [
              "9",
            ],
            "pass": {
              "from": "2026-10-07T10:00:00.001Z",
              "until": "2026-10-07T11:00:00.000Z",
            },
          },
          "tied": {
            "from": "2026-10-07T10:00:00.000Z",
            "tie": {},
            "until": "2026-10-07T11:00:00.000Z",
          },
        }
      `);
    }),
  );
});
