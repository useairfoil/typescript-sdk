import { describe, it } from "vitest";
import { PV, WingsClient } from "../src";

describe("FetchClient", () => {
  it.skip("should work", async () => {
    const namespace = "tenants/default/namespaces/default";
    const wings = new WingsClient({
      host: "localhost:7777",
      namespace,
    });

    const client = await wings.fetchClient(
      `${namespace}/topics/orders`,
      PV.int64(1n),
    );

    await client.next();
  });
});
