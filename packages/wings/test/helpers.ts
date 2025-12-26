import { Int32, makeData, RecordBatch } from "apache-arrow";
import type { ClusterMetadataClient } from "../src";
import type { FieldConfig } from "../src/lib/arrow";

export async function createTestTopic(
  client: ClusterMetadataClient,
  name: string,
) {
  return await client.createTopic({
    parent: "tenants/default/namespaces/default",
    topicId: name,
    fields: [testBatchSchema()],
    partitionKey: undefined,
    compaction: {
      freshnessSeconds: 1000n,
      ttlSeconds: undefined,
    },
    description: "test topic",
  });
}

export function testBatchSchema(): FieldConfig {
  return {
    name: "my_field",
    nullable: true,
    dataType: "Int32",
  };
}

export function makeTestBatch(): RecordBatch {
  return new RecordBatch({
    my_field: makeData({
      type: new Int32(),
      data: [1, 2, 3, 4],
    }),
  });
}
