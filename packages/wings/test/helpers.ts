import { Int32, makeData, RecordBatch } from "apache-arrow";
import type { ClusterMetadataClient } from "../src";
import type { FieldConfig } from "../src/lib/arrow";

export async function createTestTopic({
  client,
  name,
  withPartitionKey,
}: {
  withPartitionKey?: boolean;
  name: string;
  client: ClusterMetadataClient;
}) {
  const fields = withPartitionKey
    ? [testBatchSchema(), testPartitionKeySchema()]
    : [testBatchSchema()];

  return await client.createTopic({
    parent: "tenants/default/namespaces/default",
    topicId: name,
    fields,
    partitionKey: withPartitionKey ? 1 : undefined,
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
    nullable: false,
    dataType: "Int32",
    description: "test field",
  };
}

export function testPartitionKeySchema(): FieldConfig {
  return {
    name: "my_part",
    nullable: false,
    dataType: "Int32",
    description: "partition field",
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
