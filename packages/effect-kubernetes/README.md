# @useairfoil/effect-kubernetes

Effect APIs for `@kubernetes/client-node`, plus a small toolkit for building Kubernetes controllers.

- Kubernetes calls return typed `Effect` values.
- Missing objects use `Option` instead of 404 errors.
- Watches and Pod logs are scoped `Stream` values.
- Client methods keep the upstream names, parameters, and response types.
- The operator toolkit adds typed resources, CRD generation, server-side apply, conditions, ownership, reconciliation, and controller runtime.

Start with [Quick start](#quick-start) for client calls or [Operator toolkit](#operator-toolkit) for controllers. The [Memcached example](#memcached-example) exercises the full lifecycle on k3d.

## Install

```sh
pnpm add @useairfoil/effect-kubernetes @kubernetes/client-node effect
```

The package has three entry points:

```ts
import { Kubernetes, KubernetesConfig, KubernetesError } from "@useairfoil/effect-kubernetes";
import {
  Condition,
  Controller,
  Operator,
  Reconcile,
  Resource,
} from "@useairfoil/effect-kubernetes/operator";
import { makeFake } from "@useairfoil/effect-kubernetes/testing";
```

## Quick start

`KubernetesConfig.layerDefault` calls the upstream `KubeConfig.loadFromDefault()` lookup.

```ts
import { Effect, Option } from "effect";
import { Kubernetes, KubernetesConfig } from "@useairfoil/effect-kubernetes";

const program = Effect.gen(function* () {
  const apps = yield* Kubernetes.Apps;

  const deployment = yield* apps.readNamespacedDeployment({
    namespace: "team-acme",
    name: "polar-eu-account",
  });

  return Option.map(deployment, (value) => ({
    desired: value.spec?.replicas ?? 0,
    ready: value.status?.readyReplicas ?? 0,
  }));
});

Effect.runPromise(program.pipe(Effect.provide(KubernetesConfig.layerDefault)));
```

## Configuration

Use the default lookup for normal CLI and in-cluster workloads:

```ts
program.pipe(Effect.provide(KubernetesConfig.layerDefault));
```

Use an existing upstream `KubeConfig` when the application owns configuration:

```ts
import * as k8s from "@kubernetes/client-node";

const kubeConfig = new k8s.KubeConfig();
kubeConfig.loadFromFile("./kubeconfig.yaml");

program.pipe(Effect.provide(KubernetesConfig.layer(kubeConfig)));
```

Other constructors:

| API                                    | Use it when                                                     |
| -------------------------------------- | --------------------------------------------------------------- |
| `Kubernetes.make(kubeConfig)`          | You need the service value directly.                            |
| `Kubernetes.layer(kubeConfig)`         | You have a concrete upstream `KubeConfig`.                      |
| `KubernetesConfig.layerConfig(config)` | The `KubeConfig` comes from Effect `Config`.                    |
| `Kubernetes.getKubeConfig`             | You need the configured upstream object for an unsupported API. |

`Kubernetes.Kubernetes` is the `Context.Service` tag provided by these layers. `Kubernetes.make` and `Kubernetes.layer` also accept an optional `makeInformer` override for tests.

## Client

The service is grouped by Kubernetes API area. Grouped access is recommended for workflows:

```ts
const program = Effect.gen(function* () {
  const core = yield* Kubernetes.Core;
  const apps = yield* Kubernetes.Apps;

  const secret = yield* core.readNamespacedSecret({
    namespace: "team-acme",
    name: "polar-eu-account-config",
  });

  const deployments = yield* apps.listNamespacedDeployment({
    namespace: "team-acme",
    labelSelector: "airfoil.dev/connector-instance=polar-eu-account",
  });

  return { secret, deployments };
});
```

Every method is also available as a flat accessor:

```ts
const readDeployment = Kubernetes.readNamespacedDeployment({
  namespace: "team-acme",
  name: "polar-eu-account",
});
```

`readDeployment` is an `Effect`. The grouped and flat forms run the same implementation.

### Supported API groups

| Group          | Accessor                   | Resources and operations                                                                                       |
| -------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Core           | `Kubernetes.Core`          | Namespace CRUD/list; Pod CRUD/list/logs; Secret, ConfigMap, Service, and ServiceAccount CRUD/list; Event list. |
| Apps           | `Kubernetes.Apps`          | Deployment CRUD/list/status; ReplicaSet read/list.                                                             |
| Batch          | `Kubernetes.Batch`         | Job CRUD/list/collection delete/status; CronJob CRUD/list.                                                     |
| RBAC           | `Kubernetes.Rbac`          | Role, RoleBinding, ClusterRole, and ClusterRoleBinding CRUD/list.                                              |
| Networking     | `Kubernetes.Networking`    | Ingress CRUD/list.                                                                                             |
| API extensions | `Kubernetes.ApiExtensions` | CustomResourceDefinition CRUD/list.                                                                            |
| Custom objects | `Kubernetes.CustomObjects` | Namespaced and cluster-scoped create, get, list, patch, replace, delete, status, scale, and collection delete. |
| Watches        | `Kubernetes.Watch`         | Custom resources, Pods, and Deployments.                                                                       |
| Logs           | `Kubernetes.Logs`          | Scoped Pod log streams.                                                                                        |

Method names match the upstream client, for example `createNamespacedSecret`, `readNamespacedDeployment`, and `listNamespacedJob`. Request objects and optional `ConfigurationOptions` are passed through unchanged.

### Missing objects and errors

Single-object reads and deletes return `Option`:

```ts
const readSecret = Effect.gen(function* () {
  const secret = yield* Kubernetes.readNamespacedSecret({
    namespace: "team-acme",
    name: "polar-eu-account-config",
  });

  if (Option.isNone(secret)) {
    // Kubernetes returned 404.
  }
});
```

Other failures use `KubernetesError.KubernetesError` and retain the upstream diagnostics:

```ts
const handled = program.pipe(
  Effect.catchTag("KubernetesError", (error) => {
    if (KubernetesError.isConflict(error)) {
      return Effect.logWarning("Kubernetes write conflict");
    }
    return Effect.fail(error);
  }),
);
```

`KubernetesError.isNotFound` checks for 404 and `KubernetesError.isConflict` checks for 409. The error also exposes `code`, `body`, `headers`, and `cause` when provided by the upstream client.

## Watches

Watch APIs are scoped streams backed by the upstream `makeInformer` implementation. They emit normalized `Added`, `Modified`, and `Deleted` events. The example below uses the `ConnectorInstance` type defined in the operator section.

```ts
import { Effect, Stream } from "effect";

const watch = Kubernetes.watchCustomObjects<ConnectorInstance>(
  {
    group: "airfoil.dev",
    version: "v1",
    plural: "connectorinstances",
    namespaced: true,
  },
  {
    namespace: "team-acme",
    labelSelector: "airfoil.dev/connector-type=polar",
  },
);

const program = watch.pipe(
  Stream.runForEach((event) => Effect.logInfo(`${event.type}: ${event.object.metadata?.name}`)),
  Effect.scoped,
);
```

Available watches:

- `watchCustomObjects(gvr, options)`
- `watchNamespacedPods(options)`
- `watchPodsForAllNamespaces(options)`
- `watchNamespacedDeployments(options)`
- `watchDeploymentsForAllNamespaces(options)`

`WatchOptions` supports `namespace` and `labelSelector`. Closing the stream scope stops the informer. A raw watch stream fails when its informer fails; `Controller` adds reconnection and retry behavior.

## Pod logs

Use `readNamespacedPodLog` for one response:

```ts
const readLogs = Kubernetes.readNamespacedPodLog({
  namespace: "team-acme",
  name: "polar-eu-account-7dfc9",
  container: "connector",
  tailLines: 100,
});
```

Use `streamNamespacedPodLog` for a scoped stream of raw string chunks:

```ts
const logs = Kubernetes.streamNamespacedPodLog({
  namespace: "team-acme",
  name: "polar-eu-account-7dfc9",
  container: "connector",
  follow: true,
  timestamps: true,
});

const program = logs.pipe(Stream.runForEach(Effect.logInfo), Effect.scoped);
```

The stream supports `previous`, `sinceSeconds`, `sinceTime`, `tailLines`, and `limitBytes`. Closing its scope aborts the upstream log request.

## Operator toolkit

The operator entry point contains six modules:

| Module       | Purpose                                                                                            |
| ------------ | -------------------------------------------------------------------------------------------------- |
| `Resource`   | Describe, read, decode, and generate CRDs for custom resources.                                    |
| `Condition`  | Build standard Kubernetes status conditions.                                                       |
| `Operator`   | Apply Deployments, custom resources, and status with server-side apply.                            |
| `Reconcile`  | Return `complete` or `requeueAfter` from reconciliation.                                           |
| `Controller` | Run the primary watch, additional sources, resync, retry, coalescing, logging, spans, and metrics. |
| `Coalesce`   | Low-level keyed work queue used by `Controller`.                                                   |

### Define a custom resource

Use one Effect schema as the runtime decoder and CRD source of truth:

```ts
import { Schema } from "effect";
import { Condition, Resource } from "@useairfoil/effect-kubernetes/operator";

const ConnectorInstanceSchema = Schema.Struct({
  apiVersion: Schema.optionalKey(Schema.String),
  kind: Schema.optionalKey(Schema.String),
  metadata: Resource.Metadata,
  spec: Schema.Struct({
    connectorType: Schema.String,
    image: Schema.String,
    configSecretRef: Schema.String,
  }),
  status: Schema.optionalKey(
    Schema.Struct({
      observedGeneration: Schema.optionalKey(Resource.Generation),
      phase: Schema.optionalKey(Schema.String),
      conditions: Schema.optionalKey(Condition.List),
    }),
  ),
});

type ConnectorInstance = typeof ConnectorInstanceSchema.Type;

const ConnectorInstance = Resource.custom<ConnectorInstance>({
  group: "airfoil.dev",
  version: "v1",
  kind: "ConnectorInstance",
  plural: "connectorinstances",
  namespaced: true,
  schema: ConnectorInstanceSchema,
});
```

The main `Resource` APIs are:

| API                                   | Result                                                                         |
| ------------------------------------- | ------------------------------------------------------------------------------ |
| `Resource.custom(descriptor)`         | A typed, immutable resource descriptor.                                        |
| `Resource.get(resource, key)`         | Reads and decodes one object; returns `Option.none` for 404.                   |
| `Resource.list(resource, namespace?)` | Lists and decodes objects. Omit the namespace for all namespaces.              |
| `Resource.keyOf(object)`              | Extracts `{ namespace, name }` as an `Option`.                                 |
| `Resource.Metadata`                   | Reusable schema for name, namespace, UID, generation, labels, and annotations. |
| `Resource.Generation`                 | Non-negative safe-integer generation schema.                                   |

A schema mismatch fails with `Resource.ResourceDecodeError`, including the resource identity, key, and underlying `SchemaError`.

### Generate the CRD

```ts
const ConnectorInstanceCrd = Resource.makeCustomResourceDefinition(ConnectorInstance, {
  singular: "connectorinstance",
  shortNames: ["ci"],
  status: true,
  additionalPrinterColumns: [{ name: "Phase", type: "string", jsonPath: ".status.phase" }],
});
```

The result is `Effect<V1CustomResourceDefinition, CrdGenerationError>`. The generator creates one served and stored version from the resource descriptor. Options can enable the status and scale subresources, short names, and printer columns.

The generator accepts a conservative Kubernetes structural subset of Effect JSON Schema. References, definitions, unsupported combinators, and non-structural schemas fail with `CrdGenerationError` instead of producing a manifest Kubernetes may reject.

`Condition.List` uses Kubernetes map-list annotations:

```yaml
x-kubernetes-list-type: map
x-kubernetes-list-map-keys:
  - type
```

The generator validates `atomic`, `set`, and `map` list topology. Map keys must be non-empty, required scalar properties on the item schema.

CRD generation only returns an object. It does not write a file, contact a cluster, or install the CRD.

### Ownership

Create an owner reference after the parent has a name and Kubernetes-assigned UID:

```ts
const makeMetadata = Effect.gen(function* () {
  const ownerReference = yield* Resource.controllerOwnerReference(ConnectorInstance, instance);

  return {
    namespace: key.namespace,
    name: key.name,
    ownerReferences: [ownerReference],
  };
});
```

`controllerOwnerReference` fails with `IllegalArgumentError` when the parent has no server-assigned name or UID.

Map an owned object back to its controller key with `controllerOwnerKey`:

```ts
const owner = Resource.controllerOwnerKey(ConnectorInstance, deployment);
// Option<{ namespace, name }>
```

Owner references let Kubernetes garbage-collect dependents when the parent is deleted. They also provide the mapping needed by secondary controller sources.

### Conditions and generations

`Condition.Schema` implements the standard condition fields. `Condition.Status` accepts `True`, `False`, and `Unknown`.

```ts
const updateReady = Condition.set(instance.status?.conditions ?? [], {
  type: "Ready",
  status: ready ? "True" : "False",
  observedGeneration: instance.metadata?.generation,
  reason: ready ? "DeploymentReady" : "DeploymentProgressing",
  message: `${readyReplicas} of ${desiredReplicas} replicas are ready`,
});
```

Conditions are replaced by `type` and keep stable ordering. `lastTransitionTime` comes from Effect `Clock` and changes only when `status` changes. Reason, message, or generation updates keep the existing transition time.

Copy the generation read at the start of reconcile into status:

```text
status.observedGeneration < metadata.generation
  Status is stale.

status.observedGeneration === metadata.generation
  Status describes the latest desired state.
```

Equal generations do not imply readiness. Check the `Ready` condition separately.

### Server-side apply

`Operator` provides three focused SSA helpers:

| API                                                                       | Applies                                         |
| ------------------------------------------------------------------------- | ----------------------------------------------- |
| `Operator.applyDeployment(namespace, name, body, fieldManager, options?)` | An `apps/v1` Deployment.                        |
| `Operator.applyCustomObject(resource, key, body, fieldManager, options?)` | A namespaced or cluster-scoped custom resource. |
| `Operator.applyStatus(resource, key, status, fieldManager, options?)`     | The custom resource's status subresource.       |

The helpers set the correct server-side apply content type and resource identity. `force` defaults to `true` so the controller restores fields it owns.

Use separate field managers for desired resources and status:

```ts
const apply = Effect.gen(function* () {
  yield* Operator.applyDeployment(namespace, key.name, desired, "connector-operator");

  yield* Operator.applyStatus(ConnectorInstance, key, status, "connector-operator/status");
});
```

### Reconcile results

Return `Reconcile.complete` when no timed follow-up is needed:

```ts
return Reconcile.complete;
```

Return `Reconcile.requeueAfter` while waiting for a slow operation:

```ts
return Reconcile.requeueAfter("10 seconds");
```

Use Effect failures for failed reads or writes. Use `requeueAfter` only for successful reconciliation that should be checked again later. Its delay must be non-negative and finite.

### Controller

`Controller` turns watches and resyncs into level-triggered reconciliation:

```text
primary watch ─────────┐
additional sources ────┼── keyed coalescer ── reconcile({ namespace, name })
periodic resync ────────┘
```

Events only identify a key. Reconcile rereads live state and never relies on a watch payload.

```ts
const controller = Controller.layer({
  name: "connector-operator",
  resource: ConnectorInstance,
  resyncInterval: "30 seconds",
  concurrency: 4,
  reconcile,
  onGiveUp: (key, cause) =>
    Operator.applyStatus(
      ConnectorInstance,
      key,
      {
        phase: "Failed",
        message: Cause.pretty(cause),
      },
      "connector-operator/status",
    ).pipe(Effect.ignore({ log: true })),
});
```

| Option           | Meaning                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------ |
| `name`           | Used in logs, spans, and metric attributes.                                                            |
| `resource`       | Primary custom resource to watch and resync.                                                           |
| `namespace`      | Restricts a namespaced controller; omit for all namespaces.                                            |
| `resyncInterval` | Required safety net that periodically enqueues every primary object.                                   |
| `concurrency`    | Maximum keys reconciled in parallel. Defaults to `1`. A key never runs twice concurrently.             |
| `reconcile`      | Reads current state, applies desired state, writes status, and returns a `Reconcile.Result`.           |
| `retrySchedule`  | Bounded retry schedule for typed reconcile failures. Defaults to exponential jitter with five retries. |
| `onGiveUp`       | Runs after the retry budget is exhausted. The next event starts a fresh budget.                        |
| `sources`        | Additional named streams that emit primary resource keys.                                              |

`onGiveUp` is a good place to report `Ready=Unknown`. Do not advance `observedGeneration` when reconciliation did not process the latest desired state.

Use `Controller.make(options)` when the controller is the foreground program. Use `Controller.layer(options)` when composing it into an application layer.

Expected watch, source, and resync failures reconnect indefinitely with capped transient backoff. Reconcile failures use the bounded per-key schedule. Defects remain crash-loud.

The runtime emits structured logs, a `<controller>.reconcile` span, and these metrics:

- `operator_reconciles_success_total`
- `operator_reconciles_giveup_total`
- `operator_reconcile_duration`
- `operator_resyncs_total`
- `operator_watch_restarts_total`
- `operator_source_restarts_total`

### Additional sources

A source is any Effect `Stream` that emits `ResourceKey` values. Use it for owned Kubernetes resources or external signals:

```ts
const deploymentSource = Controller.source(
  "owned-deployments",
  Kubernetes.watchDeploymentsForAllNamespaces({
    labelSelector: "airfoil.dev/managed=true",
  }).pipe(
    Stream.map((event) => Resource.controllerOwnerKey(ConnectorInstance, event.object)),
    Stream.filter(Option.isSome),
    Stream.map((owner) => owner.value),
  ),
);

const controller = Controller.layer({
  // ...
  sources: [deploymentSource],
});
```

Source payloads do not enter reconcile. They are reduced to the owning primary key and pass through the same coalescer as the primary watch and resync.

Typed source failures and unexpected completion are logged and retried. Source defects terminate the controller.

### Reconcile pattern

A predictable reconcile has five steps:

```ts
const reconcile = (key: Resource.ResourceKey) =>
  Effect.gen(function* () {
    const instance = yield* Resource.get(ConnectorInstance, key);
    if (Option.isNone(instance)) return Reconcile.complete;

    if (key.namespace === undefined) {
      return yield* new Cause.IllegalArgumentError("namespace is required");
    }
    const namespace = key.namespace;

    const deployment = yield* Kubernetes.readNamespacedDeployment({
      namespace,
      name: key.name,
    });

    // One immutable view of the state used by this reconcile.
    const observation = { instance: instance.value, deployment } as const;
    const desired = deploymentFor(observation.instance);
    const { ready, status } = yield* statusFrom(observation);

    yield* Operator.applyDeployment(namespace, key.name, desired, "connector-operator");
    yield* Operator.applyStatus(ConnectorInstance, key, status, "connector-operator/status");

    return ready ? Reconcile.complete : Reconcile.requeueAfter("10 seconds");
  });
```

`deploymentFor` and `statusFrom` are application functions. The important order is:

1. Read the primary resource and required dependents once.
2. Build an immutable observation.
3. Derive the desired objects and status from that observation.
4. Apply the desired objects.
5. Write status last.

Use status for expected workload states such as progressing, unhealthy, or waiting for an external service. Fail reconcile when a required controller read or write fails.

### Coalescing

`Controller` uses `Coalesce` internally. Most operators do not need it directly.

For each key, the coalescer guarantees:

- at most one active run
- events during a run collapse into one follow-up run
- delayed requeues do not block real events
- different keys can run concurrently

The low-level API is `Coalesce.make({ concurrency, run })`, returning `offer`, `offerAfter`, and `awaitFailure`.

## Testing

Use `makeFake` for deterministic tests of custom operator behavior. It is intentionally a small fake, not a Kubernetes API-server replacement.

```ts
import { Effect } from "effect";
import { makeFake } from "@useairfoil/effect-kubernetes/testing";

const test = Effect.gen(function* () {
  const fake = yield* makeFake();

  yield* fake.put(
    {
      group: "airfoil.dev",
      version: "v1",
      plural: "connectorinstances",
      namespaced: true,
    },
    {
      metadata: { namespace: "team-acme", name: "polar-eu-account" },
      spec: { connectorType: "polar" },
    },
  );

  const result = yield* program.pipe(Effect.provide(fake.layer));
  return { result, applied: yield* fake.applied };
});
```

The fake exposes:

| API                | Purpose                                                 |
| ------------------ | ------------------------------------------------------- |
| `layer`            | Provides the `Kubernetes` service.                      |
| `put(gvr, object)` | Seeds an object.                                        |
| `emit(gvr, event)` | Sends an `Added`, `Modified`, or `Deleted` watch event. |
| `failWatch(error)` | Fails active fake watches.                              |
| `awaitWatch`       | Waits until a watch has subscribed.                     |
| `objects`          | Reads the current fake object store.                    |
| `applied`          | Reads recorded apply calls.                             |

`put` only changes the fake store. Use `emit` when the test also needs a watch event.

Use a real cluster for behavior owned by Kubernetes itself: informer semantics, schema validation, server-side apply, status subresources, owner-reference garbage collection, and workload readiness.

Run package checks from the repository root:

```sh
pnpm run format
pnpm run lint
pnpm --filter @useairfoil/effect-kubernetes typecheck
pnpm --filter @useairfoil/effect-kubernetes test:ci
pnpm --filter @useairfoil/effect-kubernetes build
```

## Memcached example

The example is adapted from the [Operator SDK Memcached tutorial](https://sdk.operatorframework.io/docs/building-operators/golang/tutorial/). It demonstrates CRD generation, a primary custom-resource watch, an owned-Deployment source, conditions, generation tracking, server-side apply, status, resync, requeue, and garbage collection.

It connects the operator modules as they are intended to be used:

| Module       | Used by the example                                                                                           |
| ------------ | ------------------------------------------------------------------------------------------------------------- |
| `Resource`   | Schema descriptor, typed get/list, keys, CRD generation, and owner mapping.                                   |
| `Condition`  | `Ready` updates with generation and transition time.                                                          |
| `Operator`   | SSA for the custom resource, Deployment, and status.                                                          |
| `Reconcile`  | `complete` and readiness polling with `requeueAfter`.                                                         |
| `Controller` | Foreground runtime, primary watch, Deployment source, resync, retries, logs, spans, and metrics.              |
| `Coalesce`   | Used inside `Controller`; its queue behavior has focused unit tests instead of a second queue in the example. |

`Controller.layer` is the application-composition alternative to the foreground `Controller.make` used by this CLI.

Run these commands from `packages/effect-kubernetes`.

### 1. Create a cluster and install the CRD

```sh
k3d cluster create effect-k8s-example
kubectl apply -f examples/memcached-crd.yaml
kubectl wait --for=condition=Established crd/memcacheds.cache.example.com --timeout=60s
```

The manifest is generated from `examples/memcached.ts`. Regenerate it after changing the schema:

```sh
pnpm example:memcached generate-crd examples/memcached-crd.yaml
```

### 2. Start the operator

In terminal 1:

```sh
pnpm example:memcached start
```

Leave it running. The first log should contain `Kubernetes controller started`.

### 3. Run the integration test

In terminal 2:

```sh
pnpm test:integration:memcached
```

The test creates and removes its own namespace. It verifies create, readiness, generation-aware status, watch-driven scaling, Deployment drift repair, and owner-reference garbage collection. It is opt-in and is not part of `test:ci`.

### 4. Clean up

Press `Ctrl+C` in terminal 1, then delete the cluster:

```sh
k3d cluster delete effect-k8s-example
```

## Controller model

The toolkit is deliberately small:

- live reads; no informer cache in reconcile
- required periodic resync as the missed-event safety net
- keyed coalescing and bounded reconcile retry
- no leader election; run one controller replica unless reconciliation is safe across replicas
- no CRD installation or conversion webhooks

Start with this model. Add caching, leader election, or more event sources only when the workload requires them.
