# @useairfoil/effect-kubernetes

Effect wrappers around `@kubernetes/client-node` for Airfoil backend deploy flows and Kubernetes operators.

The package provides:

- grouped Kubernetes clients with typed `Effect` errors
- `Option.none` for missing single objects
- scoped watch and Pod-log streams
- server-side apply helpers
- CustomResourceDefinition generation from Effect schemas
- a controller runtime with watch, resync, keyed coalescing, retries, logs, spans, and metrics
- an in-memory Kubernetes layer for operator tests

## Client

Use grouped services for workflows:

```ts
import { Effect, Option } from "effect";
import { Kubernetes, KubernetesConfig } from "@useairfoil/effect-kubernetes";

const program = Effect.gen(function* () {
  const core = yield* Kubernetes.Core;
  const apps = yield* Kubernetes.Apps;

  const secret = yield* core.readNamespacedSecret({
    namespace: "default",
    name: "credentials",
  });

  const deployments = yield* apps.listNamespacedDeployment({
    namespace: "default",
  });

  return { secret, deployments };
}).pipe(Effect.provide(KubernetesConfig.layerDefault));
```

Flat accessors are also available:

```ts
const deployment =
  yield *
  Kubernetes.readNamespacedDeployment({
    namespace: "default",
    name: "web",
  });

if (Option.isNone(deployment)) {
  // Kubernetes returned 404.
}
```

Single-object reads and deletes return `Option`. Other failures use `KubernetesError` in the Effect error channel.

Supported API groups include Core, Apps, Batch, RBAC, Networking, API extensions, custom objects, watches, and Pod logs.

### Watches

Watch helpers return scoped Effect streams:

```ts
const events = Kubernetes.watchCustomObjects<MyResource>(
  {
    group: "airfoil.dev",
    version: "v1",
    plural: "connectorinstances",
    namespaced: true,
  },
  { namespace: "default", labelSelector: "app=airfoil" },
);
```

Available helpers:

- `watchCustomObjects`
- `watchNamespacedPods`
- `watchPodsForAllNamespaces`
- `readNamespacedPodLog`
- `streamNamespacedPodLog`

Watch and streaming-log requests are stopped when their scopes close.

## Operator toolkit

```ts
import {
  Coalesce,
  Controller,
  Operator,
  Reconcile,
  Resource,
} from "@useairfoil/effect-kubernetes/operator";
import { Schema } from "effect";
```

- `Resource` defines and reads custom resources and generates their CRDs.
- `Operator` applies Deployments, custom resources, and status with server-side apply.
- `Reconcile` provides `complete` and `requeueAfter` results.
- `Coalesce` runs one reconciliation per resource key at a time.
- `Controller` combines watch events, periodic resync, retries, logs, spans, and metrics.

Generate a CRD from the same schema used to decode custom resources:

```ts
const Widget = Resource.custom({
  group: "example.com",
  version: "v1",
  kind: "Widget",
  plural: "widgets",
  namespaced: true,
  schema: Schema.Struct({ spec: Schema.Struct({ enabled: Schema.Boolean }) }),
});

const WidgetCrd = Resource.makeCustomResourceDefinition(Widget, { status: true });
```

Use `Controller.make(options)` for a foreground controller or `Controller.layer(options)` when composing application layers.

The controller performs live reads and does not maintain an object cache. It currently has no leader election or secondary-resource watches, so run one replica unless reconciliation is safe across replicas.

## Testing

Use the in-memory layer for deterministic operator tests:

```ts
import { makeFake } from "@useairfoil/effect-kubernetes/testing";

const fake = yield * makeFake();
const result = program.pipe(Effect.provide(fake.layer));
```

Package checks:

```sh
pnpm run typecheck
pnpm run test:ci
pnpm run build
```

## Try the Memcached operator

The example watches `Memcached` resources and maintains one Deployment for each resource. It is
adapted from the [Operator SDK Memcached tutorial](https://sdk.operatorframework.io/docs/building-operators/golang/tutorial/).

Prerequisites: Docker, `k3d`, `kubectl`, and workspace dependencies installed with `pnpm install`.

Run all commands below from `packages/effect-kubernetes`.

### 1. Create the cluster and install the generated CRD

```sh
k3d cluster create effect-k8s-example
kubectl apply -f examples/memcached-crd.yaml
kubectl wait --for=condition=Established crd/memcacheds.cache.example.com --timeout=60s
```

The manifest is generated from the Effect schema. Only regenerate it after changing that schema:

```sh
pnpm example:memcached generate-crd examples/memcached-crd.yaml
```

### 2. Start the operator

Open terminal 1 and run:

```sh
pnpm example:memcached start
```

Leave this terminal running. The first log should contain `Kubernetes controller started`.

### 3. Run the automated test

Open terminal 2 and run the integration test:

```sh
pnpm test:integration:memcached
```

The test uses the current kubeconfig and checks the full operator lifecycle:

- creates an isolated namespace and Memcached resource
- waits for its Deployment and `Ready` status
- changes the desired replicas and checks watch reconciliation
- introduces Deployment drift and checks periodic resync
- deletes the resource and checks owner-reference garbage collection

The namespace is deleted automatically, including when the test fails. The test is opt-in and is not included in `test:ci`.
Progress logs show which lifecycle step is currently running, including waits for readiness, watch reconciliation, resync, garbage collection, and cleanup.

### 4. Stop and clean up

In terminal 1, press `Ctrl+C` to stop the operator. Then run in terminal 2:

```sh
k3d cluster delete effect-k8s-example
```
