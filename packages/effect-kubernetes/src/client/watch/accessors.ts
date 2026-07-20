import * as k8s from "@kubernetes/client-node";
import { Effect, Stream } from "effect";

import type { KubernetesError } from "../../errors";
import type { Kubernetes } from "../context";
import type { GroupVersionResource, WatchEvent, WatchOptions } from "../service";

import { service } from "../accessor";

/** Watches custom objects using the `Kubernetes` service from context. */
export const watchCustomObjects = <A extends k8s.KubernetesObject>(
  gvr: GroupVersionResource,
  options?: WatchOptions | string,
): Stream.Stream<WatchEvent<A>, KubernetesError, Kubernetes> =>
  Stream.unwrap(
    Effect.map(service, (kubernetes) => kubernetes.watch.watchCustomObjects<A>(gvr, options)),
  );

/** Watches Pods in a Namespace using the `Kubernetes` service from context. */
export const watchNamespacedPods = (
  options: WatchOptions & { readonly namespace: string },
): Stream.Stream<WatchEvent<k8s.V1Pod>, KubernetesError, Kubernetes> =>
  Stream.unwrap(Effect.map(service, (kubernetes) => kubernetes.watch.watchNamespacedPods(options)));

/** Watches Pods across all Namespaces using the `Kubernetes` service from context. */
export const watchPodsForAllNamespaces = (
  options?: Omit<WatchOptions, "namespace">,
): Stream.Stream<WatchEvent<k8s.V1Pod>, KubernetesError, Kubernetes> =>
  Stream.unwrap(
    Effect.map(service, (kubernetes) => kubernetes.watch.watchPodsForAllNamespaces(options)),
  );

/** Watches Deployments in a Namespace using the `Kubernetes` service from context. */
export const watchNamespacedDeployments = (
  options: WatchOptions & { readonly namespace: string },
): Stream.Stream<WatchEvent<k8s.V1Deployment>, KubernetesError, Kubernetes> =>
  Stream.unwrap(
    Effect.map(service, (kubernetes) => kubernetes.watch.watchNamespacedDeployments(options)),
  );

/** Watches Deployments across all Namespaces using the `Kubernetes` service from context. */
export const watchDeploymentsForAllNamespaces = (
  options?: Omit<WatchOptions, "namespace">,
): Stream.Stream<WatchEvent<k8s.V1Deployment>, KubernetesError, Kubernetes> =>
  Stream.unwrap(
    Effect.map(service, (kubernetes) => kubernetes.watch.watchDeploymentsForAllNamespaces(options)),
  );
