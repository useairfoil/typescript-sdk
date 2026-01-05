import { Metadata } from "nice-grpc-common";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ArrowFlightSqlClient } from "../src/arrow-flight-sql";
import type { FlightInfo } from "../src/proto/Flight";
import { WingsContainer } from "./wings-container";

describe("ArrowFlightSqlClient", () => {
  let wingsContainer: WingsContainer;

  beforeAll(async () => {
    wingsContainer = new WingsContainer();
    await wingsContainer.start();
  }, 60_000);

  afterAll(async () => {
    await wingsContainer.stop();
  });

  it("get catalogs", async () => {
    const client = createClient();
    const flightInfo = await client.getCatalogs({});
    expect(await executeFlightInfo(client, flightInfo)).toMatchInlineSnapshot(`
      [
        {
          "catalog_name": "wings",
        },
      ]
    `);
  });

  it("get db schema", async () => {
    const client = createClient();
    const flightInfo = await client.getDbSchemas({
      catalog: "wings",
    });

    expect(await executeFlightInfo(client, flightInfo)).toMatchInlineSnapshot(`
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
  });

  it("get tables", async () => {
    const client = createClient();
    const flightInfo = await client.getTables({
      catalog: "wings",
      includeSchema: false,
      tableTypes: [],
    });

    expect(await executeFlightInfo(client, flightInfo)).toMatchInlineSnapshot(`
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
  });

  it("sql query", async () => {
    const client = createClient();
    const flightInfo = await client.executeQuery({
      query:
        // "select * from orders where __offset__ between 0 and 10 and o_custkey = 1 order by __offset__ asc",
        "show tables",
    });
    expect(await executeFlightInfo(client, flightInfo)).toHaveLength(13);
  });

  function createClient() {
    if (!wingsContainer) {
      throw new Error("WingsContainer not initialized");
    }
    return new ArrowFlightSqlClient(
      {
        host: wingsContainer.getGrpcHost(),
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
  }
});

async function executeFlightInfo(
  client: ArrowFlightSqlClient,
  info: FlightInfo,
) {
  const data = (await Array.fromAsync(client.executeFlightInfo(info))).flatMap(
    (batch) => batch.toArray(),
  );
  return data;
}
