import { KubeConfig } from "@kubernetes/client-node";
import { Effect } from "effect";

import { service } from "../accessor";
import { Kubernetes } from "../context";

/** Returns the underlying Kubernetes config from the `Kubernetes` service in context. */
export const getKubeConfig: Effect.Effect<KubeConfig, never, Kubernetes> = Effect.map(
  service,
  (kubernetes) => kubernetes.getKubeConfig(),
);
