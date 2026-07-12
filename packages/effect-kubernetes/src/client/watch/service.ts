import * as k8s from "@kubernetes/client-node";
import { KubeConfig, makeInformer } from "@kubernetes/client-node";
import { Cause, Effect, Queue, Stream } from "effect";

import type { KubernetesError } from "../../errors";
import type { GroupVersionResource, WatchEvent, WatchOptions } from "../types";

import { mapKubernetesError } from "../../errors";
import { tryKube } from "../helpers";

/** Effect Stream wrappers for Kubernetes watch operations. */
export interface Service {
  /** Watches custom objects for a group/version/resource. */
  readonly watchCustomObjects: <A extends k8s.KubernetesObject>(
    gvr: GroupVersionResource,
    options?: WatchOptions | string,
  ) => Stream.Stream<WatchEvent<A>, KubernetesError>;
  /** Watches Pods in a Namespace. */
  readonly watchNamespacedPods: (
    options: WatchOptions & { readonly namespace: string },
  ) => Stream.Stream<WatchEvent<k8s.V1Pod>, KubernetesError>;
  /** Watches Pods across all Namespaces. */
  readonly watchPodsForAllNamespaces: (
    options?: Omit<WatchOptions, "namespace">,
  ) => Stream.Stream<WatchEvent<k8s.V1Pod>, KubernetesError>;
}

export interface MakeWatchOptions {
  /** Overrides the upstream informer factory. Primarily useful for tests. */
  readonly makeInformer?: typeof makeInformer;
}

/** Creates watch wrappers backed by upstream Kubernetes informers. */
export const make = (
  kubeConfig: KubeConfig,
  core: k8s.CoreV1Api,
  customObjects: k8s.CustomObjectsApi,
  options?: MakeWatchOptions,
): Service => {
  const makeInformerImpl = options?.makeInformer ?? makeInformer;

  const watchObjects = <A extends k8s.KubernetesObject>(
    gvr: GroupVersionResource,
    list: () => Promise<k8s.KubernetesListObject<A>>,
    watchOptions?: WatchOptions,
  ): Stream.Stream<WatchEvent<A>, KubernetesError> =>
    Stream.callback<WatchEvent<A>, KubernetesError>((queue) =>
      Effect.acquireRelease(
        Effect.gen(function* () {
          let stopped = false;
          const informer = makeInformerImpl<A>(
            kubeConfig,
            watchPath(gvr, watchOptions?.namespace),
            list,
            watchOptions?.labelSelector,
          );

          informer.on("add", (object) => Queue.offerUnsafe(queue, { type: "Added", object }));
          informer.on("update", (object) => Queue.offerUnsafe(queue, { type: "Modified", object }));
          informer.on("delete", (object) => Queue.offerUnsafe(queue, { type: "Deleted", object }));
          informer.on("error", (error) => {
            if (stopped && isAbortError(error)) return;
            Queue.failCauseUnsafe(queue, Cause.fail(mapKubernetesError(error)));
          });

          yield* tryKube(() => informer.start());

          return {
            stop: () => {
              stopped = true;
              return informer.stop();
            },
          };
        }),
        (handle) => Effect.promise(() => handle.stop()),
      ),
    );

  return {
    watchCustomObjects: <A extends k8s.KubernetesObject>(
      gvr: GroupVersionResource,
      options?: WatchOptions | string,
    ) => {
      const watchOptions = typeof options === "string" ? { namespace: options } : options;
      return watchObjects<A>(
        gvr,
        () =>
          listCustomObjectList<A>(
            customObjects,
            gvr,
            watchOptions?.namespace,
            watchOptions?.labelSelector,
          ),
        watchOptions,
      );
    },
    watchNamespacedPods: (watchOptions) =>
      watchObjects<k8s.V1Pod>(
        { group: "", version: "v1", plural: "pods", namespaced: true },
        () =>
          core.listNamespacedPod({
            namespace: watchOptions.namespace,
            labelSelector: watchOptions.labelSelector,
          }),
        watchOptions,
      ),
    watchPodsForAllNamespaces: (watchOptions) =>
      watchObjects<k8s.V1Pod>(
        { group: "", version: "v1", plural: "pods", namespaced: true },
        () => core.listPodForAllNamespaces({ labelSelector: watchOptions?.labelSelector }),
        watchOptions,
      ),
  };
};

const watchPath = (gvr: GroupVersionResource, namespace?: string) => {
  const base = gvr.group === "" ? `/api/${gvr.version}` : `/apis/${gvr.group}/${gvr.version}`;
  return gvr.namespaced && namespace
    ? `${base}/namespaces/${namespace}/${gvr.plural}`
    : `${base}/${gvr.plural}`;
};

const listCustomObjectList = <A extends k8s.KubernetesObject>(
  api: k8s.CustomObjectsApi,
  gvr: GroupVersionResource,
  namespace?: string,
  labelSelector?: string,
): Promise<k8s.KubernetesListObject<A>> =>
  gvr.namespaced
    ? namespace
      ? api.listNamespacedCustomObject({
          group: gvr.group,
          version: gvr.version,
          namespace,
          plural: gvr.plural,
          labelSelector,
        })
      : api.listCustomObjectForAllNamespaces({
          group: gvr.group,
          version: gvr.version,
          plural: gvr.plural,
          labelSelector,
        })
    : api.listClusterCustomObject({
        group: gvr.group,
        version: gvr.version,
        plural: gvr.plural,
        labelSelector,
      });

const isAbortError = (error: unknown) => error instanceof Error && error.name === "AbortError";
