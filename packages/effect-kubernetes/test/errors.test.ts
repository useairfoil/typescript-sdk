import { describe, expect, it } from "@effect/vitest";
import * as k8s from "@kubernetes/client-node";

import { KubernetesError } from "../src";

describe("KubernetesError", () => {
  it("maps ApiException fields", () => {
    const error = KubernetesError.mapKubernetesError(
      new k8s.ApiException(404, "missing", { reason: "NotFound" }, { audit: "abc" }),
    );

    expect(error).toBeInstanceOf(KubernetesError.KubernetesError);
    expect(error.code).toBe(404);
    expect(error.body).toEqual({ reason: "NotFound" });
    expect(error.headers).toEqual({ audit: "abc" });
  });
});
