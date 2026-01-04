import { WingsContainer } from "@airfoil/flight/test";
import { customAlphabet } from "nanoid";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PV, WingsClient } from "../src";
import { createTestTopic, makeTestBatch } from "./helpers";

const makeTopicId = customAlphabet("abcdefghijklmnopqrstuvwxyz");

describe("PushClient", () => {
  let wingsContainer: WingsContainer;

  beforeEach(async () => {
    wingsContainer = new WingsContainer();
    await wingsContainer.start();
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }, 60_000);

  afterEach(async () => {
    await wingsContainer.stop();
    await new Promise((resolve) => setTimeout(resolve, 1000));
  });

  it("should work with partition values", { timeout: 10_000 }, async () => {
    const namespace = "tenants/default/namespaces/default";

    const wings = new WingsClient({
      host: wingsContainer.getGrpcHost(),
      namespace,
    });

    const topicName = makeTopicId(12);

    const topic = await createTestTopic({
      client: wings.clusterMetadataClient(),
      name: topicName,
      withPartitionKey: true,
    });

    const client = await wings.pushClient(topic.name);
    const b0 = client.push({
      batch: makeTestBatch(),
      partitionValue: PV.int32(1000),
    });

    const b1 = client.push({
      batch: makeTestBatch(),
      partitionValue: PV.int32(2000),
    });
    const b2 = client.push({
      batch: makeTestBatch(),
      partitionValue: PV.int32(3000),
    });

    const r1 = await b1;
    const r2 = await b2;
    const r0 = await b0;

    expect(r0).toMatchObject({
      $type: "wings.v1.log_metadata.CommittedBatch",
      result: {
        $case: "accepted",
        accepted: {
          $type: "wings.v1.log_metadata.CommittedBatch.Accepted",
          endOffset: 3n,
          startOffset: 0n,
        },
      },
    });

    expect(r1).toMatchObject({
      $type: "wings.v1.log_metadata.CommittedBatch",
      result: {
        $case: "accepted",
        accepted: {
          $type: "wings.v1.log_metadata.CommittedBatch.Accepted",
          endOffset: 3n,
          startOffset: 0n,
        },
      },
    });

    expect(r2).toMatchObject({
      $type: "wings.v1.log_metadata.CommittedBatch",
      result: {
        $case: "accepted",
        accepted: {
          $type: "wings.v1.log_metadata.CommittedBatch.Accepted",
          endOffset: 3n,
          startOffset: 0n,
        },
      },
    });
  });

  it("should work without partition values", { timeout: 10_000 }, async () => {
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

    expect(r0).toMatchObject({
      $type: "wings.v1.log_metadata.CommittedBatch",
      result: {
        $case: "accepted",
        accepted: {
          $type: "wings.v1.log_metadata.CommittedBatch.Accepted",
          endOffset: 3n,
          startOffset: 0n,
        },
      },
    });

    expect(r1).toMatchObject({
      $type: "wings.v1.log_metadata.CommittedBatch",
      result: {
        $case: "accepted",
        accepted: {
          $type: "wings.v1.log_metadata.CommittedBatch.Accepted",
          endOffset: 7n,
          startOffset: 4n,
        },
      },
    });

    expect(r2).toMatchObject({
      $type: "wings.v1.log_metadata.CommittedBatch",
      result: {
        $case: "accepted",
        accepted: {
          $type: "wings.v1.log_metadata.CommittedBatch.Accepted",
          endOffset: 11n,
          startOffset: 8n,
        },
      },
    });
  });
});
