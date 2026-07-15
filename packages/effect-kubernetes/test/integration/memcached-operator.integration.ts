import { describe, expect, it } from "@effect/vitest";
import * as k8s from "@kubernetes/client-node";
import { Data, Duration, Effect, Option, Schedule } from "effect";

import {
  Memcached,
  MemcachedGvr,
  type Memcached as MemcachedObject,
} from "../../examples/memcached";
import { Kubernetes, KubernetesConfig } from "../../src";
import { Operator, Resource } from "../../src/operator";

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

        yield* Operator.applyCustomObject(
          Memcached,
          key,
          { metadata: { namespace, name }, spec: { size: 2 } },
          "effect-kubernetes-integration",
        );
        const listed = yield* Resource.list(Memcached, namespace);
        expect(listed).toHaveLength(1);
        expect(listed.map(Resource.keyOf)).toContainEqual(Option.some(key));
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
          Resource.get(Memcached, key),
          Option.exists((resource) => hasCurrentReadyStatus(resource, 2)),
          "Operator did not report the Memcached resource as Ready.",
        );
        const readyResource = Option.getOrThrow(initialResource);
        expect(readyResource.spec.size).toBe(2);
        expect(readyResource.status?.observedGeneration).toBe(readyResource.metadata?.generation);
        expect(
          readyResource.status?.conditions?.find((condition) => condition.type === "Ready")
            ?.lastTransitionTime,
        ).toBeInstanceOf(Date);
        expect(Option.getOrThrow(initialDeployment).metadata?.ownerReferences?.[0]?.uid).toBe(
          readyResource.metadata?.uid,
        );
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
          Resource.get(Memcached, key),
          Option.exists((resource) => hasCurrentReadyStatus(resource, 3)),
          "Operator did not report the scaled Memcached resource as Ready.",
        );
        yield* Effect.logInfo("Watch reconciliation completed with three ready replicas");
        yield* Effect.logInfo("Waiting for pending requeues before introducing drift");
        yield* Effect.sleep("7 seconds");

        yield* Effect.logInfo("Scaling Deployment directly to zero; waiting for its watch event");
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
          "The owned-Deployment watch did not restore three replicas before periodic resync.",
          "15 seconds",
        );
        expect(Option.getOrThrow(repairedDeployment).spec?.replicas).toBe(3);
        yield* Effect.logInfo("Owned-Deployment watch restored three replicas");

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

const hasCurrentReadyStatus = (resource: MemcachedObject, replicas: number): boolean => {
  const generation = resource.metadata?.generation;
  const ready = resource.status?.conditions?.find((condition) => condition.type === "Ready");
  return (
    generation !== undefined &&
    resource.status?.readyReplicas === replicas &&
    resource.status.phase === "Ready" &&
    resource.status.observedGeneration === generation &&
    ready?.status === "True" &&
    ready.observedGeneration === generation
  );
};
