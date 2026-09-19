# Effect Kubernetes

This package gives an Effect API for `@kubernetes/client-node`. Operator helpers
are in `@useairfoil/effect-kubernetes/operator`. Test helpers are in
`@useairfoil/effect-kubernetes/testing`.

## Install

```bash
pnpm add @useairfoil/effect-kubernetes effect@rc @kubernetes/client-node
```

## Usage

```ts
import { Kubernetes, KubernetesConfig } from "@useairfoil/effect-kubernetes";
import { Effect } from "effect";

const pods = Kubernetes.listNamespacedPod({ namespace: "default" }).pipe(
  Effect.provide(KubernetesConfig.layerDefault),
);
```
