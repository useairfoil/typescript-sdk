import { describe, expect, it } from "@effect/vitest";
import { Effect, Option, Ref, Schema } from "effect";
import { TestClock } from "effect/testing";

import type { FakeRequest, FakeSalesforce } from "./helpers";

import { SalesforceConnector, manifest } from "../src/index";
import { tableSchemas } from "../src/tables";
import { connectorLayer, describeField, makeFakeClient, objectDescribe, plain } from "./helpers";

const now = Date.parse("2026-10-15T12:00:30.000Z");

const accountDescribe = objectDescribe("Account", [
  describeField("Id", "id"),
  describeField("IsDeleted", "boolean"),
  describeField("Name"),
  describeField("AnnualRevenue", "currency"),
  describeField("BillingAddress", "address"),
  describeField("LastViewedDate", "datetime"),
  describeField("CreatedDate", "datetime"),
  describeField("SystemModstamp", "datetime"),
]);

const account = (id: string, name = `Account ${id}`) => ({
  attributes: { type: "Account", url: `/services/data/v68.0/sobjects/Account/${id}` },
  Id: id,
  IsDeleted: false,
  Name: name,
  AnnualRevenue: 1000000.0,
  CreatedDate: "2026-10-14T10:00:00.000+0000",
  SystemModstamp: "2026-10-15T10:00:00.000+0000",
});

const ReadBodySchema = Schema.Struct({ ids: Schema.Array(Schema.String) });

/** A fake org. `live` lists the IDs that still read. */
const fakeOrg = (options: {
  readonly updated?: ReadonlyArray<string>;
  readonly deleted?: ReadonlyArray<string>;
  readonly live: ReadonlyArray<string>;
  /** `latestDateCovered` of each `getUpdated` call, in order. */
  readonly updatedCovered?: ReadonlyArray<string>;
  readonly deletedCovered?: string;
  readonly extra?: FakeSalesforce;
}): FakeSalesforce => {
  const live = new Set(options.live);
  let updatedCalls = 0;
  return (request) => {
    const extra = options.extra?.(request);
    if (extra !== undefined) return extra;
    switch (request.path) {
      case "/sobjects":
        return {
          sobjects: [{ name: "Account", custom: false, queryable: true, replicateable: true }],
        };
      case "/sobjects/Account/describe":
        return accountDescribe;
      case "/sobjects/Account/updated/":
        return {
          ids: options.updated ?? [],
          latestDateCovered:
            options.updatedCovered?.[updatedCalls++] ?? "2026-10-15T03:14:00.000+0000",
        };
      case "/sobjects/Account/deleted/":
        return {
          deletedRecords: (options.deleted ?? []).map((id) => ({
            id,
            deletedDate: "2026-10-15T11:00:00.000+0000",
          })),
          earliestDateAvailable: "2026-10-01T00:00:00.000+0000",
          latestDateCovered: options.deletedCovered ?? "2026-10-15T03:14:00.000+0000",
        };
      case "/composite/sobjects/Account": {
        const { ids } = Schema.decodeUnknownSync(ReadBodySchema)(request.body);
        return ids.map((id) => (live.has(id) ? account(id) : null));
      }
    }
    return undefined;
  };
};

const shortRequest = (request: FakeRequest) =>
  [
    request.method,
    request.path,
    request.params === undefined ? "" : new URLSearchParams(request.params).toString(),
    request.body === undefined ? "" : JSON.stringify(request.body),
  ]
    .filter((part) => part !== "")
    .join(" ");

type ResourceName = (typeof manifest.resources)[number]["name"];

const getResource = (name: ResourceName, fake: FakeSalesforce) =>
  Effect.gen(function* () {
    yield* TestClock.setTime(now);
    const { client, requests } = yield* makeFakeClient(fake);
    const connector = yield* SalesforceConnector.SalesforceConnector.pipe(
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
      requests: Ref.get(requests).pipe(Effect.map((items) => items.map(shortRequest))),
    };
  });

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

describe("object tables", () => {
  it.effect("matches the manifest and the table schemas", () =>
    Effect.gen(function* () {
      const { client } = yield* makeFakeClient(() => undefined);
      const connector = yield* SalesforceConnector.SalesforceConnector.pipe(
        Effect.provide(connectorLayer(client)),
      );
      const names = connector.resources.map((item) => item.name);

      expect(names).toEqual(manifest.resources.map((item) => item.name));
      expect(names).toEqual(Object.keys(tableSchemas));
    }),
  );

  it.effect("backfills by ID and maps every readable field to a string", () =>
    Effect.gen(function* () {
      const { backfill, requests } = yield* getResource(
        "accounts",
        fakeOrg({
          live: ["001A", "001B"],
          extra: (request) =>
            request.path === "/queryAll"
              ? { done: true, records: [{ Id: "001A" }, { Id: "001B" }] }
              : undefined,
        }),
      );
      const page = yield* backfill.fetch({
        cutoff: "2026-10-15T00:00:00.000Z",
        pageCursor: "0019",
      });
      expect({
        page: plain({ ...page, rows: page.rows.slice(0, 1) }),
        requests: yield* requests,
      }).toMatchInlineSnapshot(`
        {
          "page": {
            "hasMore": false,
            "nextPageCursor": "001B",
            "rows": [
              {
                "_deleted": false,
                "created_at": "2026-10-14T10:00:00.000Z",
                "fields": {
                  "AnnualRevenue": "1000000",
                  "CreatedDate": "2026-10-14T10:00:00.000+0000",
                  "Id": "001A",
                  "IsDeleted": "false",
                  "Name": "Account 001A",
                  "SystemModstamp": "2026-10-15T10:00:00.000+0000",
                },
                "id": "001A",
                "updated_at": "2026-10-15T10:00:00.000Z",
                "version": "2026-10-15T12:00:00.000Z",
              },
            ],
          },
          "requests": [
            "GET /sobjects/Account/describe",
            "GET /queryAll q=SELECT+Id+FROM+Account+WHERE+IsDeleted+%3D+false+AND+Id+%3E+%270019%27+ORDER+BY+Id+LIMIT+2000",
            "POST /composite/sobjects/Account {"ids":["001A","001B"],"fields":["Id","IsDeleted","Name","AnnualRevenue","CreatedDate","SystemModstamp"]}",
          ],
        }
      `);
    }),
  );

  it.effect("describes again and retries once when a field is removed", () =>
    Effect.gen(function* () {
      let describes = 0;
      const { backfill, requests } = yield* getResource("accounts", (request) => {
        switch (request.path) {
          case "/sobjects/Account/describe":
            // The first describe still lists `Gone__c`, which an admin then removes.
            return objectDescribe("Account", [
              describeField("Id", "id"),
              ...(describes++ === 0 ? [describeField("Gone__c")] : []),
            ]);
          case "/queryAll":
            return { done: true, records: [{ Id: "001A" }] };
          case "/composite/sobjects/Account": {
            const { fields } = Schema.decodeUnknownSync(
              Schema.Struct({ fields: Schema.Array(Schema.String) }),
            )(request.body);
            return fields.includes("Gone__c")
              ? undefined
              : [{ attributes: { type: "Account", url: "/x" }, Id: "001A" }];
          }
        }
        return undefined;
      });
      const page = yield* backfill.fetch({ cutoff: "2026-10-15T00:00:00.000Z" });
      expect({
        ids: page.rows.map((row) => row.id),
        requests: (yield* requests).filter((request) => !request.includes("queryAll")),
      }).toMatchInlineSnapshot(`
        {
          "ids": [
            "001A",
          ],
          "requests": [
            "GET /sobjects/Account/describe",
            "POST /composite/sobjects/Account {"ids":["001A"],"fields":["Id","Gone__c"]}",
            "GET /sobjects/Account/describe",
            "POST /composite/sobjects/Account {"ids":["001A"],"fields":["Id"]}",
          ],
        }
      `);
    }),
  );

  it.effect("reads updates, then sends deletes for records that no longer read", () =>
    Effect.gen(function* () {
      const { changes, requests } = yield* getResource(
        "accounts",
        // 001C was deleted and restored in the window, so it still reads.
        fakeOrg({
          updated: ["001B", "001A"],
          deleted: ["001D", "001C"],
          live: ["001A", "001B", "001C"],
        }),
      );
      const updated = yield* changes.fetch({ cursor: "2026-10-15T09:00:00.000Z" });
      const deleted = yield* changes.fetch({ cursor: updated.cursor });
      expect({
        updated: {
          ids: updated.rows.map((row) => row.id),
          cursor: updated.cursor,
          hasMore: updated.hasMore,
        },
        deleted: plain(deleted),
        requests: yield* requests,
      }).toMatchInlineSnapshot(`
        {
          "deleted": {
            "cursor": "{"_tag":"idle","start":"2026-10-15T03:14:00.000Z"}",
            "rows": [
              {
                "_deleted": true,
                "id": "001D",
                "version": "2026-10-15T12:00:30.000Z",
              },
            ],
          },
          "requests": [
            "GET /sobjects/Account/describe",
            "GET /sobjects/Account/updated/ start=2026-10-15T09%3A00%3A00.000Z&end=2026-10-15T12%3A00%3A00.000Z",
            "POST /composite/sobjects/Account {"ids":["001A","001B"],"fields":["Id","IsDeleted","Name","AnnualRevenue","CreatedDate","SystemModstamp"]}",
            "GET /sobjects/Account/deleted/ start=2026-10-15T09%3A00%3A00.000Z&end=2026-10-15T12%3A00%3A00.000Z",
            "POST /composite/sobjects/Account {"ids":["001D","001C"],"fields":["Id","IsDeleted","Name","AnnualRevenue","CreatedDate","SystemModstamp"]}",
          ],
          "updated": {
            "cursor": "{"_tag":"deleted","start":"2026-10-15T09:00:00.000Z","end":"2026-10-15T12:00:00.000Z","latest":"2026-10-15T03:14:00.000Z"}",
            "hasMore": true,
            "ids": [
              "001A",
              "001B",
            ],
          },
        }
      `);
    }),
  );

  it.effect("starts the next window at the earlier of the update and delete coverage", () =>
    Effect.gen(function* () {
      const { changes } = yield* getResource(
        "accounts",
        fakeOrg({ live: [], deletedCovered: "2026-10-15T01:14:00.000+0000" }),
      );
      const updated = yield* changes.fetch({ cursor: "2026-10-15T09:00:00.000Z" });
      const deleted = yield* changes.fetch({ cursor: updated.cursor });
      expect(deleted.cursor).toMatchInlineSnapshot(
        `"{"_tag":"idle","start":"2026-10-15T01:14:00.000Z"}"`,
      );
    }),
  );

  it.effect("waits for a whole minute before reading a window", () =>
    Effect.gen(function* () {
      const { changes, requests } = yield* getResource("accounts", fakeOrg({ live: [] }));
      const result = yield* changes.fetch({ cursor: "2026-10-15T12:00:10.000Z" });
      expect({ result, requests: yield* requests }).toMatchInlineSnapshot(`
        {
          "requests": [
            "GET /sobjects/Account/describe",
          ],
          "result": {
            "cursor": "2026-10-15T12:00:10.000Z",
            "rows": [],
          },
        }
      `);
    }),
  );

  it.effect("goes on from the last ID when a window has more IDs than one run reads", () =>
    Effect.gen(function* () {
      const ids = Array.from({ length: 40_001 }, (_, i) => `001${String(i).padStart(6, "0")}`);
      // The second call covers later, but the window keeps the earlier one.
      const { changes } = yield* getResource(
        "accounts",
        fakeOrg({
          updated: ids,
          live: ids,
          updatedCovered: ["2026-10-15T03:14:00.000+0000", "2026-10-15T09:30:00.000+0000"],
        }),
      );
      const first = yield* changes.fetch({ cursor: "2026-10-15T09:00:00.000Z" });
      const second = yield* changes.fetch({ cursor: first.cursor });
      expect({
        first: { rows: first.rows.length, cursor: first.cursor, hasMore: first.hasMore },
        second: { ids: second.rows.map((row) => row.id), cursor: second.cursor },
      }).toMatchInlineSnapshot(`
        {
          "first": {
            "cursor": "{"_tag":"updated","start":"2026-10-15T09:00:00.000Z","end":"2026-10-15T12:00:00.000Z","latest":"2026-10-15T03:14:00.000Z","after":"001039999"}",
            "hasMore": true,
            "rows": 40000,
          },
          "second": {
            "cursor": "{"_tag":"deleted","start":"2026-10-15T09:00:00.000Z","end":"2026-10-15T12:00:00.000Z","latest":"2026-10-15T03:14:00.000Z"}",
            "ids": [
              "001040000",
            ],
          },
        }
      `);
    }),
  );

  it.effect("fails when the last read is older than Salesforce keeps deletes", () =>
    Effect.gen(function* () {
      const { changes } = yield* getResource("accounts", fakeOrg({ live: [] }));
      const error = yield* Effect.gen(function* () {
        return yield* changes.fetch({ cursor: "2026-09-29T00:00:00.000Z" });
      }).pipe(Effect.flip);
      expect(errorMessage(error)).toMatchInlineSnapshot(
        `"Salesforce keeps deletes for 15 days, and Account was last read at 2026-09-29T00:00:00.000Z. Backfill it again."`,
      );
    }),
  );

  it.effect("skips deletes for objects Salesforce can't list deletes for", () =>
    Effect.gen(function* () {
      const { changes, requests } = yield* getResource("organization", (request) =>
        request.path === "/sobjects/Organization/describe"
          ? objectDescribe("Organization", [describeField("Id", "id"), describeField("Name")])
          : request.path === "/sobjects/Organization/updated/"
            ? { ids: [], latestDateCovered: "2026-10-15T03:14:00.000+0000" }
            : undefined,
      );
      const result = yield* changes.fetch({ cursor: "2026-10-15T09:00:00.000Z" });
      expect({ result, requests: yield* requests }).toMatchInlineSnapshot(`
        {
          "requests": [
            "GET /sobjects/Organization/describe",
            "GET /sobjects/Organization/updated/ start=2026-10-15T09%3A00%3A00.000Z&end=2026-10-15T12%3A00%3A00.000Z",
          ],
          "result": {
            "cursor": "{"_tag":"idle","start":"2026-10-15T03:14:00.000Z"}",
            "rows": [],
          },
        }
      `);
    }),
  );

  it.effect("reads objects that can't be replicated in full every hour", () =>
    Effect.gen(function* () {
      const { changes, requests } = yield* getResource("permission_sets", (request) => {
        switch (request.path) {
          case "/sobjects/PermissionSet/describe":
            return objectDescribe(
              "PermissionSet",
              [describeField("Id", "id"), describeField("Name")],
              { replicateable: false },
            );
          case "/queryAll":
            return { done: true, records: [{ Id: "0PS1" }] };
          case "/composite/sobjects/PermissionSet":
            return [
              { attributes: { type: "PermissionSet", url: "/x" }, Id: "0PS1", Name: "Sales" },
            ];
        }
        return undefined;
      });
      const notDue = yield* changes.fetch({
        cursor: JSON.stringify({ _tag: "idle", last: "2026-10-15T11:30:00.000Z" }),
      });
      const due = yield* changes.fetch({
        cursor: JSON.stringify({ _tag: "idle", last: "2026-10-15T10:30:00.000Z" }),
      });
      expect({
        notDue,
        due: { ids: due.rows.map((row) => row.id), cursor: due.cursor },
        requests: yield* requests,
      }).toMatchInlineSnapshot(`
        {
          "due": {
            "cursor": "{"_tag":"idle","last":"2026-10-15T12:00:30.000Z"}",
            "ids": [
              "0PS1",
            ],
          },
          "notDue": {
            "cursor": "{"_tag":"idle","last":"2026-10-15T11:30:00.000Z"}",
            "rows": [],
          },
          "requests": [
            "GET /sobjects/PermissionSet/describe",
            "GET /queryAll q=SELECT+Id+FROM+PermissionSet+ORDER+BY+Id+LIMIT+2000",
            "POST /composite/sobjects/PermissionSet {"ids":["0PS1"],"fields":["Id","Name"]}",
          ],
        }
      `);
    }),
  );
});

describe("custom_objects", () => {
  it.effect("reads a new custom object in full, then by its own changes cursor", () =>
    Effect.gen(function* () {
      const { changes } = yield* getResource("custom_objects", (request) => {
        switch (request.path) {
          case "/sobjects":
            return {
              sobjects: [
                { name: "Invoice__c", custom: true, queryable: true, replicateable: true },
                { name: "Setting__mdt", custom: true, queryable: true, replicateable: false },
              ],
            };
          case "/sobjects/Invoice__c/describe":
            return objectDescribe("Invoice__c", [
              describeField("Id", "id"),
              describeField("Total__c", "double"),
            ]);
          case "/queryAll":
            return { done: true, records: [{ Id: "a001" }] };
          case "/sobjects/Invoice__c/updated/":
            return { ids: [], latestDateCovered: "2026-10-15T11:00:00.000+0000" };
          case "/sobjects/Invoice__c/deleted/":
            return { deletedRecords: [], latestDateCovered: "2026-10-15T11:00:00.000+0000" };
          case "/composite/sobjects/Invoice__c":
            return [{ attributes: { type: "Invoice__c", url: "/x" }, Id: "a001", Total__c: 12.5 }];
        }
        return undefined;
      });
      // The backfill saw no objects, so Invoice__c is new.
      const first = yield* changes.fetch({ cursor: JSON.stringify({ objects: {} }) });
      const second = yield* changes.fetch({ cursor: first.cursor });
      expect({ first: plain(first), secondCursor: second.cursor }).toMatchInlineSnapshot(`
        {
          "first": {
            "cursor": "{"objects":{"Invoice__c":{"_tag":"changes","cursor":"2026-10-15T12:00:30.000Z"}}}",
            "hasMore": false,
            "rows": [
              {
                "_deleted": false,
                "created_at": null,
                "fields": {
                  "Id": "a001",
                  "Total__c": "12.5",
                },
                "id": "a001",
                "object": "Invoice__c",
                "updated_at": null,
                "version": "2026-10-15T12:00:00.000Z",
              },
            ],
          },
          "secondCursor": "{"objects":{"Invoice__c":{"_tag":"changes","cursor":"2026-10-15T12:00:30.000Z"}}}",
        }
      `);
    }),
  );
});

describe("object_fields", () => {
  it.effect("describes the synced objects the org has", () =>
    Effect.gen(function* () {
      const { backfill, requests } = yield* getResource("object_fields", (request) => {
        switch (request.path) {
          case "/sobjects":
            return {
              sobjects: [{ name: "Account", custom: false, queryable: true, replicateable: true }],
            };
          case "/sobjects/Account/describe":
            return objectDescribe("Account", [
              {
                ...describeField("Industry", "picklist"),
                picklistValues: [
                  { value: "Finance", label: "Finance", active: true },
                  { value: "Mining", label: "Mining", active: false },
                ],
              },
            ]);
        }
        return undefined;
      });
      const page = yield* backfill.fetch({ cutoff: "2026-10-15T00:00:00.000Z" });
      expect({ rows: plain(page.rows), requests: yield* requests }).toMatchInlineSnapshot(`
        {
          "requests": [
            "GET /sobjects",
            "GET /sobjects/Account/describe",
          ],
          "rows": [
            {
              "calculated": false,
              "custom": false,
              "id": "Account.Industry",
              "label": "Industry",
              "length": "0n",
              "name": "Industry",
              "nillable": true,
              "object": "Account",
              "picklist_values": [
                {
                  "active": true,
                  "label": "Finance",
                  "value": "Finance",
                },
                {
                  "active": false,
                  "label": "Mining",
                  "value": "Mining",
                },
              ],
              "precision": "0n",
              "reference_to": [],
              "scale": "0n",
              "type": "picklist",
              "version": "2026-10-15T12:00:30.000Z",
            },
          ],
        }
      `);
    }),
  );
});
