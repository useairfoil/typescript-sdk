import type { FlightInfo } from "@useairfoil/flight";

import { expect, layer } from "@effect/vitest";
import { ArrowFlightSqlClient } from "@useairfoil/flight";
import { TestWings } from "@useairfoil/wings-testing";
import { Effect, Layer, Stream } from "effect";
import { ChannelCredentials } from "nice-grpc";
import { Metadata } from "nice-grpc-common";

import { ClusterClient } from "../src";
import { makeId, TEST_LAKE, TEST_OBJECT_STORE } from "./helpers";

let testNamespace = "";

const sqlClientLayer = Layer.effect(ArrowFlightSqlClient.ArrowFlightSqlClient)(
  Effect.gen(function* () {
    const wings = yield* TestWings.Instance;
    const host = yield* wings.grpcHostAndPort;
    const namespaceId = makeId();
    testNamespace = `namespaces/${namespaceId}`;

    const clusterClient = yield* ClusterClient.make({ host });
    yield* clusterClient.createNamespace({
      namespaceId,
      objectStore: TEST_OBJECT_STORE,
      lake: TEST_LAKE,
    });

    return yield* ArrowFlightSqlClient.make({
      host,
      credentials: ChannelCredentials.createInsecure(),
      defaultCallOptions: {
        "*": {
          metadata: Metadata({
            "x-wings-namespace": testNamespace,
          }),
        },
      },
    });
  }),
).pipe(Layer.provide(TestWings.container));

layer(sqlClientLayer, { timeout: "120 seconds" })("Wings Flight SQL", (it) => {
  it.effect("get catalogs", () =>
    Effect.gen(function* () {
      const client = yield* ArrowFlightSqlClient.ArrowFlightSqlClient;

      const flightInfo = yield* client.getCatalogs({});
      const data = yield* executeFlightInfo(client, flightInfo);

      expect(data).toMatchInlineSnapshot(`
      [
        {
          "catalog_name": "wings",
        },
      ]
    `);
    }),
  );

  it.effect("get db schema", () =>
    Effect.gen(function* () {
      const client = yield* ArrowFlightSqlClient.ArrowFlightSqlClient;

      const flightInfo = yield* client.getDbSchemas({
        catalog: "wings",
      });

      const data = yield* executeFlightInfo(client, flightInfo);

      expect(data).toMatchInlineSnapshot(`
      [
        {
          "catalog_name": "wings",
          "db_schema_name": "public",
        },
        {
          "catalog_name": "wings",
          "db_schema_name": "system",
        },
      ]
    `);
    }),
  );

  it.effect("get tables", () =>
    Effect.gen(function* () {
      const client = yield* ArrowFlightSqlClient.ArrowFlightSqlClient;

      const flightInfo = yield* client.getTables({
        catalog: "wings",
        includeSchema: false,
        tableTypes: [],
      });

      const data = yield* executeFlightInfo(client, flightInfo);

      expect(data).toMatchInlineSnapshot(`
      [
        {
          "catalog_name": "wings",
          "db_schema_name": "system",
          "table_name": "namespace_info",
          "table_type": "VIEW",
        },
        {
          "catalog_name": "wings",
          "db_schema_name": "system",
          "table_name": "table_schemas",
          "table_type": "VIEW",
        },
        {
          "catalog_name": "wings",
          "db_schema_name": "system",
          "table_name": "tables",
          "table_type": "VIEW",
        },
      ]
    `);
    }),
  );

  it.effect("sql query", () =>
    Effect.gen(function* () {
      const client = yield* ArrowFlightSqlClient.ArrowFlightSqlClient;

      const flightInfo = yield* client.executeQuery({
        query: "show tables",
      });

      const data = yield* executeFlightInfo(client, flightInfo);
      expect(data).toHaveLength(10);
    }),
  );
});

const executeFlightInfo = (
  client: ArrowFlightSqlClient.ArrowFlightSqlClientService,
  info: FlightInfo,
) =>
  client.executeFlightInfo(info).pipe(
    Stream.runCollect,
    Effect.map((batches) => Array.from(batches).flatMap(({ batch }) => batch.toArray())),
  );
