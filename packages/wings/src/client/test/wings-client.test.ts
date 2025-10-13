import { describe, it } from "vitest";
import { WingsClient } from "../wings-client";

describe("WingsClient", () => {
  it("should create a client and push data to a topic", async () => {
    const client = new WingsClient({
      connectionString: "127.0.0.1:7777",
      namespace: "tenants/default/namespaces/default",
    });

    /*
    const topicClient = await client.topic(
      "tenants/default/namespaces/default/topics/perfect",
    );

    await topicClient.push({
      field1: "value1",
      // field2: "value2",
      // field3: "value3",
      // field4: "value4",
    });
    */

    await client.fetch("tenants/default/namespaces/default/topics/perfect");
  });
});
