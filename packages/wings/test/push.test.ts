import { customAlphabet } from "nanoid";
import { describe, expect, it } from "vitest";
import { WingsClient } from "../src";
import { createTestTopic, makeTestBatch } from "./helpers";

const makeTopicId = customAlphabet("abcdefghijklmnopqrstuvwxyz");

describe("PushClient", () => {
  it("should work", async () => {
    const namespace = "tenants/default/namespaces/default";

    const wings = new WingsClient({
      host: "localhost:7777",
      namespace,
    });

    const topicName = makeTopicId(12);
    const topic = await createTestTopic(
      wings.clusterMetadataClient(),
      topicName,
    );

    const client = await wings.pushClient(topic.name);

    const b0 = client.push({
      batch: makeTestBatch(),
    });
    const b1 = client.push({
      batch: makeTestBatch(),
    });
    const b2 = client.push({
      batch: makeTestBatch(),
    });

    const r1 = await b1;
    const r2 = await b2;
    const r0 = await b0;

    expect(r0).toMatchInlineSnapshot(`
      {
        "$type": "wings.v1.log_metadata.CommittedBatch",
        "result": {
          "$case": "accepted",
          "accepted": {
            "$type": "wings.v1.log_metadata.CommittedBatch.Accepted",
            "endOffset": 3n,
            "startOffset": 0n,
            "timestamp": 2025-10-14T11:47:26.891Z,
          },
        },
      }
    `);

    expect(r1).toMatchInlineSnapshot(`
      {
        "$type": "wings.v1.log_metadata.CommittedBatch",
        "result": {
          "$case": "accepted",
          "accepted": {
            "$type": "wings.v1.log_metadata.CommittedBatch.Accepted",
            "endOffset": 7n,
            "startOffset": 4n,
            "timestamp": 2025-10-14T11:47:26.891Z,
          },
        },
      }
    `);

    expect(r2).toMatchInlineSnapshot(`
      {
        "$type": "wings.v1.log_metadata.CommittedBatch",
        "result": {
          "$case": "accepted",
          "accepted": {
            "$type": "wings.v1.log_metadata.CommittedBatch.Accepted",
            "endOffset": 11n,
            "startOffset": 8n,
            "timestamp": 2025-10-14T11:47:26.891Z,
          },
        },
      }
    `);
  });
});
