/**
 * Adapted from the Operator SDK Memcached tutorial:
 * https://sdk.operatorframework.io/docs/building-operators/golang/tutorial/
 */
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import * as k8s from "@kubernetes/client-node";
import { Cause, Console, Effect, FileSystem, Option, Stream } from "effect";
import { Argument, Command } from "effect/unstable/cli";

import packageJson from "../package.json";
import { Kubernetes, KubernetesConfig } from "../src";
import { Condition, Controller, Operator, Reconcile, Resource } from "../src/operator";
import { Memcached, MemcachedCrd, type Memcached as MemcachedObject } from "./memcached";

const FIELD_MANAGER = "memcached-operator";

const reconcile = (key: Resource.ResourceKey) =>
  Effect.gen(function* () {
    const memcached = yield* Resource.get(Memcached, key);
    if (Option.isNone(memcached)) return Reconcile.complete;

    if (key.namespace === undefined) {
      return yield* new Cause.IllegalArgumentError("namespace is required");
    }
    const namespace = key.namespace;
    const deployment = yield* Kubernetes.readNamespacedDeployment({ namespace, name: key.name });
    // Derive desired state and status from one immutable view of the live objects.
    const observation = { memcached: memcached.value, deployment } as const;
    const ownerReference = yield* Resource.controllerOwnerReference(
      Memcached,
      observation.memcached,
    );
    const desired = deploymentFor(observation.memcached, ownerReference);
    const readyReplicas = Option.match(deployment, {
      onNone: () => 0,
      onSome: (current) => current.status?.readyReplicas ?? 0,
    });
    const wantedReplicas = observation.memcached.spec.size;
    const ready = Option.exists(
      observation.deployment,
      (current) =>
        current.spec?.replicas === wantedReplicas &&
        current.status?.observedGeneration === current.metadata?.generation &&
        readyReplicas >= wantedReplicas,
    );
    const conditions = yield* Condition.set(observation.memcached.status?.conditions ?? [], {
      type: "Ready",
      status: ready ? "True" : "False",
      ...(observation.memcached.metadata?.generation === undefined
        ? {}
        : { observedGeneration: observation.memcached.metadata.generation }),
      reason: ready ? "DeploymentReady" : "DeploymentProgressing",
      message: `${readyReplicas} of ${wantedReplicas} replicas are ready`,
    });

    yield* Operator.applyDeployment(namespace, key.name, desired, FIELD_MANAGER);

    // Write status last so observedGeneration describes the observation used above.
    yield* Operator.applyStatus(
      Memcached,
      key,
      {
        ...(observation.memcached.metadata?.generation === undefined
          ? {}
          : { observedGeneration: observation.memcached.metadata.generation }),
        readyReplicas,
        phase: ready ? "Ready" : "Progressing",
        conditions,
      },
      `${FIELD_MANAGER}/status`,
    );

    return ready ? Reconcile.complete : Reconcile.requeueAfter("5 seconds");
  });

const deploymentFor = (
  memcached: MemcachedObject,
  ownerReference: k8s.V1OwnerReference,
): k8s.V1Deployment => {
  const name = memcached.metadata?.name ?? "memcached";
  const namespace = memcached.metadata?.namespace ?? "default";
  const labels = { app: "memcached", "cache.example.com/name": name };

  return {
    apiVersion: "apps/v1",
    kind: "Deployment",
    metadata: {
      name,
      namespace,
      labels,
      ownerReferences: [ownerReference],
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

// Child events map back to the owning Memcached key; reconcile still rereads live state.
const deploymentSource = Controller.source(
  "owned-deployments",
  Kubernetes.watchDeploymentsForAllNamespaces({ labelSelector: "app=memcached" }).pipe(
    Stream.map((event) => Resource.controllerOwnerKey(Memcached, event.object)),
    Stream.filter(Option.isSome),
    Stream.map((owner) => owner.value),
  ),
);

const Main = Controller.make({
  name: "memcached-operator",
  resource: Memcached,
  resyncInterval: "30 seconds",
  sources: [deploymentSource],
  reconcile,
  onGiveUp: (key, cause) =>
    Effect.gen(function* () {
      const message = Cause.pretty(cause);
      const conditions = yield* Condition.set([], {
        type: "Ready",
        status: "Unknown",
        reason: "ReconcileFailed",
        message,
      });
      yield* Operator.applyStatus(
        Memcached,
        key,
        { phase: "Failed", message, conditions },
        `${FIELD_MANAGER}/status`,
      );
    }).pipe(Effect.ignore({ log: true })),
}).pipe(Effect.provide(KubernetesConfig.layerDefault));

const startCommand = Command.make("start", {}, () => Main).pipe(
  Command.withDescription("Start the Memcached operator"),
);

const outputArgument = Argument.string("output").pipe(
  Argument.withDescription("Write the generated YAML to this file"),
  Argument.optional,
);

const generateCrdCommand = Command.make("generate-crd", { output: outputArgument }, ({ output }) =>
  Effect.gen(function* () {
    const crd = yield* MemcachedCrd;
    const yaml =
      "# Generated by the Memcached example. Do not edit manually.\n" + k8s.dumpYaml(crd).trimEnd();

    yield* Option.match(output, {
      onNone: () => Console.log(yaml),
      onSome: (path) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          yield* fs.writeFileString(path, `${yaml}\n`);
          yield* Console.log(`Generated ${path}`);
        }),
    });
  }),
).pipe(Command.withDescription("Generate the Memcached CustomResourceDefinition YAML"));

const program = Command.make("memcached").pipe(
  Command.withDescription("Run the Effect Kubernetes Memcached example"),
  Command.withSubcommands([startCommand, generateCrdCommand]),
);

Command.run(program, { version: packageJson.version }).pipe(
  Effect.provide(NodeServices.layer),
  Effect.scoped,
  NodeRuntime.runMain,
);
