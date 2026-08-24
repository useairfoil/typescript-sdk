import { describe, expect, it } from "@effect/vitest";
import { Metadata } from "nice-grpc";

import { withWingsNamespace } from "../src/data-plane/layer";

describe("WingsClient layer", () => {
  it("preserves caller metadata and overrides only the trusted namespace", () => {
    const signal = new AbortController().signal;
    const original = Metadata({
      authorization: "Bearer token",
      "x-wings-namespace": "namespaces/untrusted",
      "x-request-id": "request-1",
    });

    const options = withWingsNamespace({ metadata: original, signal }, "namespaces/team-acme");

    expect(options.metadata?.get("authorization")).toBe("Bearer token");
    expect(options.metadata?.get("x-request-id")).toBe("request-1");
    expect(options.metadata?.get("x-wings-namespace")).toBe("namespaces/team-acme");
    expect(original.get("x-wings-namespace")).toBe("namespaces/untrusted");
    expect(options.signal).toBe(signal);
  });
});
