import { Field, Int32, makeData, RecordBatch, Schema } from "apache-arrow";
import { type ClusterMetadataServiceClient, encodeTopicSchema } from "../src/";

export async function createTestTopic(
  client: ClusterMetadataServiceClient,
  name: string,
) {
  console.log("Creating topic:", name);
  return await client.createTopic({
    parent: "tenants/default/namespaces/default",
    topicId: name,
    topic: {
      fields: encodeTopicSchema(testBatchSchema()),
      partitionKey: undefined,
    },
  });
}

export function testBatchSchema(): Schema {
  return new Schema([new Field("my_field", new Int32())]);
}

export function makeTestBatch(): RecordBatch {
  return new RecordBatch({
    my_field: makeData({
      type: new Int32(),
      data: [1, 2, 3, 4],
    }),
  });
}
