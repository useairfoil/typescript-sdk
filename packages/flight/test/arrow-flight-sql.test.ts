import { describe, expect, it } from "@effect/vitest";
import { TestWings } from "@useairfoil/wings-testing";
import { Effect } from "effect";
import { ChannelCredentials } from "nice-grpc";
import { Metadata } from "nice-grpc-common";

import type { FlightInfo } from "../src/proto/Flight";

import { ArrowFlightSqlClient } from "../src/arrow-flight-sql";

const wingsLayer = TestWings.container;

describe("ArrowFlightSqlClient", () => {
  it.effect("get catalogs", () =>
    Effect.gen(function* () {
      const client = yield* createClient();

      const flightInfo = yield* Effect.promise(() => client.getCatalogs({}));
      const data = yield* executeFlightInfo(client, flightInfo);
      expect(data).toMatchInlineSnapshot(`
      [
        {
          "catalog_name": "wings",
        },
      ]
    `);
    }).pipe(Effect.provide(wingsLayer), Effect.scoped),
  );

  it.effect("get db schema", () =>
    Effect.gen(function* () {
      const client = yield* createClient();
      const flightInfo = yield* Effect.promise(() =>
        client.getDbSchemas({
          catalog: "wings",
        }),
      );

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
    }).pipe(Effect.provide(wingsLayer), Effect.scoped),
  );

  it.effect("get tables", () =>
    Effect.gen(function* () {
      const client = yield* createClient();
      const flightInfo = yield* Effect.promise(() =>
        client.getTables({
          catalog: "wings",
          includeSchema: false,
          tableTypes: [],
        }),
      );

      const data = yield* executeFlightInfo(client, flightInfo);
      expect(data).toMatchInlineSnapshot(`
      [
        {
          "catalog_name": "wings",
          "db_schema_name": "system",
          "table_name": "metrics",
          "table_type": "VIEW",
        },
        {
          "catalog_name": "wings",
          "db_schema_name": "system",
          "table_name": "namespace_info",
          "table_type": "VIEW",
        },
        {
          "catalog_name": "wings",
          "db_schema_name": "system",
          "table_name": "topic",
          "table_type": "VIEW",
        },
        {
          "catalog_name": "wings",
          "db_schema_name": "system",
          "table_name": "topic_offset_location",
          "table_type": "VIEW",
        },
        {
          "catalog_name": "wings",
          "db_schema_name": "system",
          "table_name": "topic_partition_value",
          "table_type": "VIEW",
        },
        {
          "catalog_name": "wings",
          "db_schema_name": "system",
          "table_name": "topic_schema",
          "table_type": "VIEW",
        },
      ]
    `);
    }).pipe(Effect.provide(wingsLayer), Effect.scoped),
  );

  it.effect("sql query", () =>
    Effect.gen(function* () {
      const client = yield* createClient();
      const flightInfo = yield* Effect.promise(() =>
        client.executeQuery({
          query: "show tables",
        }),
      );

      const data = yield* executeFlightInfo(client, flightInfo);
      expect(data).toHaveLength(13);
    }).pipe(Effect.provide(wingsLayer), Effect.scoped),
  );
});

const createClient = () =>
  Effect.gen(function* () {
    const wings = yield* TestWings.Instance;
    const host = yield* wings.grpcHostAndPort;
    return new ArrowFlightSqlClient(
      {
        host,
        credentials: ChannelCredentials.createInsecure(),
      },
      {
        defaultCallOptions: {
          "*": {
            metadata: Metadata({
              "x-wings-namespace": "tenants/default/namespaces/default",
            }),
          },
        },
      },
    );
  });

const executeFlightInfo = (client: ArrowFlightSqlClient, info: FlightInfo) =>
  Effect.promise(async () => {
    const data = (await Array.fromAsync(client.executeFlightInfo(info))).flatMap((batch) =>
      batch.toArray(),
    );
    return data;
  });
