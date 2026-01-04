import { WingsContainer } from "@airfoil/flight/test";
import { customAlphabet } from "nanoid";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  arrowTableToRowColumns,
  PV,
  recordBatchToTable,
  WingsClient,
} from "../src";
import { createTestTopic, makeTestBatch } from "./helpers";

const makeTopicId = customAlphabet("abcdefghijklmnopqrstuvwxyz");

describe("FetchClient", () => {
  let wingsContainer: WingsContainer;

  beforeEach(async () => {
    wingsContainer = new WingsContainer();
    await wingsContainer.start();
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }, 60_000);

  afterEach(async () => {
    await wingsContainer.stop();
    // extra timeout to shut down because testcontainer sometimes clashes for the same port
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }, 60_000);

  it("should work without partitionKey", { timeout: 30_000 }, async () => {
    const namespace = "tenants/default/namespaces/default";

    const wings = new WingsClient({
      host: wingsContainer.getGrpcHost(),
      namespace,
    });

    const topicName = makeTopicId(12);

    const topic = await createTestTopic({
      client: wings.clusterMetadataClient(),
      name: topicName,
    });

    const pushClient = await wings.pushClient(topic.name);

    const p0 = pushClient.push({
      batch: makeTestBatch(),
    });

    const p1 = pushClient.push({
      batch: makeTestBatch(),
    });

    await p0;
    await p1;

    const fetchClient = await wings.fetchClient(topic.name);
    const batches = await fetchClient.next();

    const table = recordBatchToTable(batches);
    const { columns, rows } = arrowTableToRowColumns(table);

    expect(rows).toMatchObject([
      {
        __offset__: 0n,
        my_field: 1,
      },
      {
        __offset__: 1n,
        my_field: 2,
      },
      {
        __offset__: 2n,
        my_field: 3,
      },
      {
        __offset__: 3n,
        my_field: 4,
      },
      {
        __offset__: 4n,
        my_field: 1,
      },
      {
        __offset__: 5n,
        my_field: 2,
      },
      {
        __offset__: 6n,
        my_field: 3,
      },
      {
        __offset__: 7n,
        my_field: 4,
      },
    ]);
    expect(columns).toMatchInlineSnapshot(`
      [
        {
          "name": "my_field",
          "type": "Int32",
        },
        {
          "name": "__offset__",
          "type": "Uint64",
        },
        {
          "name": "__timestamp__",
          "type": "Timestamp<MILLISECOND>",
        },
      ]
    `);
  });

  it("should work with partitionKey", { timeout: 30_000 }, async () => {
    const namespace = "tenants/default/namespaces/default";

    const wings = new WingsClient({
      host: wingsContainer.getGrpcHost(),
      // host: "localhost:7777",
      namespace,
    });

    const topicName = makeTopicId(12);

    const topic = await createTestTopic({
      client: wings.clusterMetadataClient(),
      name: topicName,
      withPartitionKey: true,
    });

    const pushClient = await wings.pushClient(topic.name);

    const p0 = pushClient.push({
      batch: makeTestBatch(),
      partitionValue: PV.int32(1000),
    });

    const p1 = pushClient.push({
      batch: makeTestBatch(),
      partitionValue: PV.int32(2000),
    });

    await p0;
    await p1;

    const fetchClientP1 = await wings.fetchClient(topic.name, PV.int32(1000));
    const batchesP1 = await fetchClientP1.next();

    const tableP1 = recordBatchToTable(batchesP1);
    const { columns: columnsP1, rows: rowsP1 } =
      arrowTableToRowColumns(tableP1);

    expect(rowsP1).toMatchObject([
      {
        __offset__: 0n,
        my_field: 1,
        my_part: 1000,
      },
      {
        __offset__: 1n,
        my_field: 2,
        my_part: 1000,
      },
      {
        __offset__: 2n,
        my_field: 3,
        my_part: 1000,
      },
      {
        __offset__: 3n,
        my_field: 4,
        my_part: 1000,
      },
    ]);
    expect(columnsP1).toMatchInlineSnapshot(`
      [
        {
          "name": "my_field",
          "type": "Int32",
        },
        {
          "name": "my_part",
          "type": "Int32",
        },
        {
          "name": "__offset__",
          "type": "Uint64",
        },
        {
          "name": "__timestamp__",
          "type": "Timestamp<MILLISECOND>",
        },
      ]
    `);

    const fetchClientP2 = await wings.fetchClient(topic.name, PV.int32(2000));
    const batchesP2 = await fetchClientP2.next();

    const tableP2 = recordBatchToTable(batchesP2);
    const { columns: columnsP2, rows: rowsP2 } =
      arrowTableToRowColumns(tableP2);

    expect(rowsP2).toMatchObject([
      {
        __offset__: 0n,
        my_field: 1,
        my_part: 2000,
      },
      {
        __offset__: 1n,
        my_field: 2,
        my_part: 2000,
      },
      {
        __offset__: 2n,
        my_field: 3,
        my_part: 2000,
      },
      {
        __offset__: 3n,
        my_field: 4,
        my_part: 2000,
      },
    ]);
    expect(columnsP2).toMatchInlineSnapshot(`
      [
        {
          "name": "my_field",
          "type": "Int32",
        },
        {
          "name": "my_part",
          "type": "Int32",
        },
        {
          "name": "__offset__",
          "type": "Uint64",
        },
        {
          "name": "__timestamp__",
          "type": "Timestamp<MILLISECOND>",
        },
      ]
    `);
  });
});
