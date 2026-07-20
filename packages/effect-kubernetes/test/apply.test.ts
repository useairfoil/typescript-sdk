import { describe, expect, it } from "@effect/vitest";
import { Effect, Option } from "effect";

import { Kubernetes } from "../src";
import { Operator, Resource } from "../src/operator";
import { makeFake } from "../src/testing";

interface TestObject extends Resource.KubernetesObjectShape {
  readonly spec?: { readonly value?: string };
  readonly status?: { readonly phase?: string };
}

const TestResource = Resource.custom<TestObject>({
  group: "example.com",
  version: "v1",
  kind: "Test",
  plural: "tests",
  namespaced: true,
});

describe("Operator apply", () => {
  it.effect("applies deployments with identity and SSA options", () =>
    Effect.gen(function* () {
      const fake = yield* makeFake();

      const deployment = yield* Operator.applyDeployment(
        "default",
        "demo",
        {
          spec: {
            replicas: 2,
            selector: { matchLabels: { app: "demo" } },
            template: {
              metadata: { labels: { app: "demo" } },
              spec: { containers: [{ name: "demo", image: "busybox" }] },
            },
          },
        },
        "test-manager",
      ).pipe(Effect.provide(fake.layer));
      const applied = yield* fake.applied;

      expect(deployment.apiVersion).toBe("apps/v1");
      expect(deployment.kind).toBe("Deployment");
      expect(deployment.metadata?.namespace).toBe("default");
      expect(deployment.metadata?.name).toBe("demo");
      expect(applied[0]?.operation).toBe("patchNamespacedDeployment");
      expect(applied[0]?.params).toEqual(
        expect.objectContaining({ fieldManager: "test-manager", force: true }),
      );
      expect(applied[0]?.options).toEqual(
        expect.objectContaining({ middlewareMergeStrategy: "append" }),
      );

      const current = yield* Kubernetes.readNamespacedDeployment({
        namespace: "default",
        name: "demo",
      }).pipe(Effect.provide(fake.layer));
      expect(Option.getOrThrow(current).spec?.replicas).toBe(2);
    }),
  );

  it.effect("applies custom resource status", () =>
    Effect.gen(function* () {
      const fake = yield* makeFake();
      yield* fake.put(
        { group: "example.com", version: "v1", plural: "tests", namespaced: true },
        {
          metadata: { namespace: "default", name: "demo" },
          spec: { value: "keep" },
        },
      );

      const status = yield* Operator.applyStatus(
        TestResource,
        { namespace: "default", name: "demo" },
        { phase: "Ready" },
        "test-manager/status",
      ).pipe(Effect.provide(fake.layer));
      const applied = yield* fake.applied;

      expect(status.apiVersion).toBe("example.com/v1");
      expect(status.kind).toBe("Test");
      expect(status.status?.phase).toBe("Ready");
      expect(status.spec?.value).toBe("keep");
      expect(applied[0]?.operation).toBe("patchNamespacedCustomObjectStatus");
      expect(applied[0]?.params).toEqual(
        expect.objectContaining({ fieldManager: "test-manager/status", force: true }),
      );
    }),
  );
});
