import { describe, expect, it } from "@effect/vitest";
import * as k8s from "@kubernetes/client-node";
import { Data, Duration, Effect, Option, Schedule } from "effect";

import {
  Memcached,
  MemcachedGvr,
  type Memcached as MemcachedObject,
} from "../../examples/memcached";
import { Kubernetes, KubernetesConfig } from "../../src";
import { Operator } from "../../src/operator";

class ConditionNotMet extends Data.TaggedError("ConditionNotMet")<{}> {}

const waitFor = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  predicate: (value: A) => boolean,
  message: string,
  timeout: Duration.Input = "180 seconds",
) =>
  effect.pipe(
    Effect.filterOrFail(predicate, () => new ConditionNotMet()),
    Effect.retry(Schedule.spaced("1 second")),
    Effect.timeoutOrElse({
      duration: timeout,
      orElse: () => Effect.fail(new Error(message)),
    }),
  );

describe("Memcached example operator", () => {
  it.live("reconciles create, scale, drift, and deletion", () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const namespace = `effect-kubernetes-${suffix}`;
    const name = "memcached-test";
    const key = { namespace, name };

    return Effect.scoped(
      Effect.gen(function* () {
        yield* Effect.logInfo("Checking Memcached CRD");
        const crd = yield* Kubernetes.readCustomResourceDefinition({
          name: "memcacheds.cache.example.com",
        });
        if (Option.isNone(crd)) {
          return yield* Effect.fail(
            new Error(
              "Memcached CRD is not installed. Follow the README setup before running this test.",
            ),
          );
        }

        yield* Kubernetes.createNamespace({
          body: { metadata: { name: namespace } },
        });
        yield* Effect.logInfo("Created integration namespace");
        yield* Effect.addFinalizer(() =>
          Effect.logInfo("Deleting integration namespace").pipe(
            Effect.andThen(Kubernetes.deleteNamespace({ name: namespace })),
            Effect.ignore,
          ),
        );

        yield* Kubernetes.createNamespacedCustomObject<MemcachedObject>({
          ...MemcachedGvr,
          namespace,
          body: {
            apiVersion: `${MemcachedGvr.group}/${MemcachedGvr.version}`,
            kind: "Memcached",
            metadata: { namespace, name },
            spec: { size: 2 },
          },
        });
        yield* Effect.logInfo("Created two-replica Memcached resource; waiting for readiness");

        const initialDeployment = yield* waitFor(
          Kubernetes.readNamespacedDeployment({ namespace, name }),
          Option.exists(
            (deployment) =>
              deployment.spec?.replicas === 2 && deployment.status?.readyReplicas === 2,
          ),
          "Operator did not create a ready two-replica Deployment. Is it running?",
        );
        expect(Option.getOrThrow(initialDeployment).metadata?.ownerReferences?.[0]?.name).toBe(
          name,
        );

        const initialResource = yield* waitFor(
          Kubernetes.getNamespacedCustomObject<MemcachedObject>({
            ...MemcachedGvr,
            namespace,
            name,
          }),
          Option.exists(
            (resource) => resource.status?.readyReplicas === 2 && resource.status.phase === "Ready",
          ),
          "Operator did not report the Memcached resource as Ready.",
        );
        expect(Option.getOrThrow(initialResource).spec.size).toBe(2);
        yield* Effect.logInfo("Memcached resource is ready with two replicas");

        yield* Effect.logInfo("Scaling Memcached resource to three replicas");
        yield* Operator.applyCustomObject(
          Memcached,
          key,
          { metadata: { namespace, name }, spec: { size: 3 } },
          "effect-kubernetes-integration",
        );

        const scaledDeployment = yield* waitFor(
          Kubernetes.readNamespacedDeployment({ namespace, name }),
          Option.exists(
            (deployment) =>
              deployment.spec?.replicas === 3 && deployment.status?.readyReplicas === 3,
          ),
          "Watch reconciliation did not scale the Deployment to three replicas.",
        );
        expect(Option.getOrThrow(scaledDeployment).spec?.replicas).toBe(3);

        yield* waitFor(
          Kubernetes.getNamespacedCustomObject<MemcachedObject>({
            ...MemcachedGvr,
            namespace,
            name,
          }),
          Option.exists(
            (resource) => resource.status?.readyReplicas === 3 && resource.status.phase === "Ready",
          ),
          "Operator did not report the scaled Memcached resource as Ready.",
        );
        yield* Effect.logInfo("Watch reconciliation completed with three ready replicas");
        yield* Effect.logInfo("Waiting for pending requeues before introducing drift");
        yield* Effect.sleep("7 seconds");

        yield* Effect.logInfo("Scaling Deployment directly to zero; waiting for periodic resync");
        const driftedDeployment = yield* Kubernetes.patchNamespacedDeployment(
          {
            namespace,
            name,
            body: { spec: { replicas: 0 } },
          },
          k8s.setHeaderOptions("Content-Type", k8s.PatchStrategy.MergePatch),
        );
        expect(driftedDeployment.spec?.replicas).toBe(0);

        const repairedDeployment = yield* waitFor(
          Kubernetes.readNamespacedDeployment({ namespace, name }),
          Option.exists((deployment) => deployment.spec?.replicas === 3),
          "Periodic resync did not restore the Deployment to three replicas.",
          "90 seconds",
        );
        expect(Option.getOrThrow(repairedDeployment).spec?.replicas).toBe(3);
        yield* Effect.logInfo("Periodic resync restored the Deployment to three replicas");

        yield* Effect.logInfo("Deleting Memcached resource; waiting for garbage collection");
        yield* Kubernetes.deleteNamespacedCustomObject({
          ...MemcachedGvr,
          namespace,
          name,
        });

        const deletedDeployment = yield* waitFor(
          Kubernetes.readNamespacedDeployment({ namespace, name }),
          Option.isNone,
          "The owned Deployment was not garbage collected after deleting the Memcached resource.",
        );
        expect(Option.isNone(deletedDeployment)).toBe(true);
        yield* Effect.logInfo("Owned Deployment was deleted");
      }).pipe(
        Effect.annotateLogs({ namespace, name }),
        Effect.provide(KubernetesConfig.layerDefault),
      ),
    );
  });
});
