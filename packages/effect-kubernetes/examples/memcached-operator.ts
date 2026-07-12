/**
 * Run:
 *   k3d cluster create effect-k8s-example
 *   kubectl apply -f examples/memcached-crd.yaml
 *   pnpm --filter @useairfoil/effect-kubernetes example:memcached
 *
 * In another terminal:
 *   kubectl apply -f examples/memcached-sample.yaml
 *   kubectl get deployment memcached-sample
 *   kubectl get memcached memcached-sample -o yaml
 *   kubectl patch memcached memcached-sample --type merge -p '{"spec":{"size":3}}'
 *   kubectl delete memcached memcached-sample
 */
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as k8s from "@kubernetes/client-node";
import { Cause, Effect, Layer, Option } from "effect";

import { Kubernetes, KubernetesConfig } from "../src";
import { Controller, Operator, Reconcile, Resource } from "../src/operator";
import { Memcached, type Memcached as MemcachedObject } from "./memcached";

const FIELD_MANAGER = "memcached-operator";

const reconcile = (key: Resource.ResourceKey) =>
  Effect.gen(function* () {
    const memcached = yield* Resource.get(Memcached, key);
    if (Option.isNone(memcached)) return Reconcile.complete;

    if (key.namespace === undefined) {
      return yield* new Cause.IllegalArgumentError("namespace is required");
    }
    const namespace = key.namespace;
    const desired = deploymentFor(memcached.value);

    yield* Operator.applyDeployment(namespace, key.name, desired, FIELD_MANAGER);

    const deployment = yield* Kubernetes.readNamespacedDeployment({ namespace, name: key.name });
    const readyReplicas = Option.match(deployment, {
      onNone: () => 0,
      onSome: (current) => current.status?.readyReplicas ?? 0,
    });
    const wantedReplicas = memcached.value.spec.size;

    yield* Operator.applyStatus(
      Memcached,
      key,
      {
        readyReplicas,
        phase: readyReplicas >= wantedReplicas ? "Ready" : "Progressing",
      },
      `${FIELD_MANAGER}/status`,
    );

    return readyReplicas >= wantedReplicas
      ? Reconcile.complete
      : Reconcile.requeueAfter("5 seconds");
  });

const deploymentFor = (memcached: MemcachedObject): k8s.V1Deployment => {
  const name = memcached.metadata?.name ?? "memcached";
  const namespace = memcached.metadata?.namespace ?? "default";
  const labels = { app: "memcached", "cache.example.com/name": name };
  const ownerReferences =
    memcached.metadata?.uid === undefined
      ? []
      : [
          {
            apiVersion: "cache.example.com/v1alpha1",
            kind: "Memcached",
            name,
            uid: memcached.metadata.uid,
            controller: true,
            blockOwnerDeletion: true,
          },
        ];

  return {
    apiVersion: "apps/v1",
    kind: "Deployment",
    metadata: {
      name,
      namespace,
      labels,
      ownerReferences,
    },
    spec: {
      replicas: memcached.spec.size,
      selector: { matchLabels: labels },
      template: {
        metadata: { labels },
        spec: {
          containers: [
            {
              name: "memcached",
              image: "memcached:1.6",
              ports: [{ containerPort: 11211, name: "memcached" }],
            },
          ],
        },
      },
    },
  };
};

const MainLive = Controller.layer({
  name: "memcached-operator",
  resource: Memcached,
  resyncInterval: "30 seconds",
  reconcile,
  onGiveUp: (key, cause) =>
    Operator.applyStatus(
      Memcached,
      key,
      { phase: "Failed", message: Cause.pretty(cause) },
      `${FIELD_MANAGER}/status`,
    ).pipe(Effect.ignore({ log: true })),
}).pipe(Layer.provide(KubernetesConfig.layerDefault));

NodeRuntime.runMain(Layer.launch(MainLive));
