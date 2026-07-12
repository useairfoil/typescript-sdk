import * as k8s from "@kubernetes/client-node";

import type { KubeEffect, KubeOptionEffect } from "../types";

import { tryKube, tryKubeOption } from "../helpers";

/** Effect wrappers for Kubernetes CustomObjectsApi operations. */
export interface Service {
  /** Creates a cluster-scoped custom object. */
  readonly createClusterCustomObject: <A extends k8s.KubernetesObject>(
    params: k8s.CustomObjectsApiCreateClusterCustomObjectRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeEffect<A>;
  /** Creates a namespaced custom object. */
  readonly createNamespacedCustomObject: <A extends k8s.KubernetesObject>(
    params: k8s.CustomObjectsApiCreateNamespacedCustomObjectRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeEffect<A>;
  /** Reads a cluster-scoped custom object, returning `Option.none` when it is not found. */
  readonly getClusterCustomObject: <A extends k8s.KubernetesObject>(
    params: k8s.CustomObjectsApiGetClusterCustomObjectRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeOptionEffect<A>;
  /** Reads a namespaced custom object, returning `Option.none` when it is not found. */
  readonly getNamespacedCustomObject: <A extends k8s.KubernetesObject>(
    params: k8s.CustomObjectsApiGetNamespacedCustomObjectRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeOptionEffect<A>;
  /** Lists cluster-scoped custom objects. */
  readonly listClusterCustomObject: <A extends k8s.KubernetesObject>(
    params: k8s.CustomObjectsApiListClusterCustomObjectRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeEffect<k8s.KubernetesListObject<A>>;
  /** Lists namespaced custom objects across all Namespaces. */
  readonly listCustomObjectForAllNamespaces: <A extends k8s.KubernetesObject>(
    params: k8s.CustomObjectsApiListCustomObjectForAllNamespacesRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeEffect<k8s.KubernetesListObject<A>>;
  /** Lists custom objects in a Namespace. */
  readonly listNamespacedCustomObject: <A extends k8s.KubernetesObject>(
    params: k8s.CustomObjectsApiListNamespacedCustomObjectRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeEffect<k8s.KubernetesListObject<A>>;
  /** Patches a cluster-scoped custom object. */
  readonly patchClusterCustomObject: <A extends k8s.KubernetesObject>(
    params: k8s.CustomObjectsApiPatchClusterCustomObjectRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeEffect<A>;
  /** Patches a namespaced custom object. */
  readonly patchNamespacedCustomObject: <A extends k8s.KubernetesObject>(
    params: k8s.CustomObjectsApiPatchNamespacedCustomObjectRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeEffect<A>;
  /** Replaces a cluster-scoped custom object. */
  readonly replaceClusterCustomObject: <A extends k8s.KubernetesObject>(
    params: k8s.CustomObjectsApiReplaceClusterCustomObjectRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeEffect<A>;
  /** Replaces a namespaced custom object. */
  readonly replaceNamespacedCustomObject: <A extends k8s.KubernetesObject>(
    params: k8s.CustomObjectsApiReplaceNamespacedCustomObjectRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeEffect<A>;
  /** Deletes a cluster-scoped custom object, returning `Option.none` when it is already absent. */
  readonly deleteClusterCustomObject: <A = unknown>(
    params: k8s.CustomObjectsApiDeleteClusterCustomObjectRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeOptionEffect<A>;
  /** Deletes a namespaced custom object, returning `Option.none` when it is already absent. */
  readonly deleteNamespacedCustomObject: <A = unknown>(
    params: k8s.CustomObjectsApiDeleteNamespacedCustomObjectRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeOptionEffect<A>;
  /** Deletes a collection of cluster-scoped custom objects. */
  readonly deleteCollectionClusterCustomObject: <A = unknown>(
    params: k8s.CustomObjectsApiDeleteCollectionClusterCustomObjectRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeEffect<A>;
  /** Deletes a collection of namespaced custom objects. */
  readonly deleteCollectionNamespacedCustomObject: <A = unknown>(
    params: k8s.CustomObjectsApiDeleteCollectionNamespacedCustomObjectRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeEffect<A>;
  /** Reads cluster-scoped custom object status, returning `Option.none` when it is not found. */
  readonly getClusterCustomObjectStatus: <A extends k8s.KubernetesObject>(
    params: k8s.CustomObjectsApiGetClusterCustomObjectStatusRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeOptionEffect<A>;
  /** Reads namespaced custom object status, returning `Option.none` when it is not found. */
  readonly getNamespacedCustomObjectStatus: <A extends k8s.KubernetesObject>(
    params: k8s.CustomObjectsApiGetNamespacedCustomObjectStatusRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeOptionEffect<A>;
  /** Patches cluster-scoped custom object status. */
  readonly patchClusterCustomObjectStatus: <A extends k8s.KubernetesObject>(
    params: k8s.CustomObjectsApiPatchClusterCustomObjectStatusRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeEffect<A>;
  /** Patches namespaced custom object status. */
  readonly patchNamespacedCustomObjectStatus: <A extends k8s.KubernetesObject>(
    params: k8s.CustomObjectsApiPatchNamespacedCustomObjectStatusRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeEffect<A>;
  /** Replaces cluster-scoped custom object status. */
  readonly replaceClusterCustomObjectStatus: <A extends k8s.KubernetesObject>(
    params: k8s.CustomObjectsApiReplaceClusterCustomObjectStatusRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeEffect<A>;
  /** Replaces namespaced custom object status. */
  readonly replaceNamespacedCustomObjectStatus: <A extends k8s.KubernetesObject>(
    params: k8s.CustomObjectsApiReplaceNamespacedCustomObjectStatusRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeEffect<A>;
  /** Reads cluster-scoped custom object scale, returning `Option.none` when it is not found. */
  readonly getClusterCustomObjectScale: <A extends k8s.KubernetesObject>(
    params: k8s.CustomObjectsApiGetClusterCustomObjectScaleRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeOptionEffect<A>;
  /** Reads namespaced custom object scale, returning `Option.none` when it is not found. */
  readonly getNamespacedCustomObjectScale: <A extends k8s.KubernetesObject>(
    params: k8s.CustomObjectsApiGetNamespacedCustomObjectScaleRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeOptionEffect<A>;
  /** Patches cluster-scoped custom object scale. */
  readonly patchClusterCustomObjectScale: <A extends k8s.KubernetesObject>(
    params: k8s.CustomObjectsApiPatchClusterCustomObjectScaleRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeEffect<A>;
  /** Patches namespaced custom object scale. */
  readonly patchNamespacedCustomObjectScale: <A extends k8s.KubernetesObject>(
    params: k8s.CustomObjectsApiPatchNamespacedCustomObjectScaleRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeEffect<A>;
}

/** Creates custom-object operation wrappers from an upstream Kubernetes CustomObjectsApi client. */
export const make = (customObjects: k8s.CustomObjectsApi): Service => ({
  createClusterCustomObject: (params, options) =>
    tryKube(() => customObjects.createClusterCustomObject(params, options)),
  createNamespacedCustomObject: (params, options) =>
    tryKube(() => customObjects.createNamespacedCustomObject(params, options)),
  getClusterCustomObject: (params, options) =>
    tryKubeOption(() => customObjects.getClusterCustomObject(params, options)),
  getNamespacedCustomObject: (params, options) =>
    tryKubeOption(() => customObjects.getNamespacedCustomObject(params, options)),
  listClusterCustomObject: (params, options) =>
    tryKube(() => customObjects.listClusterCustomObject(params, options)),
  listCustomObjectForAllNamespaces: (params, options) =>
    tryKube(() => customObjects.listCustomObjectForAllNamespaces(params, options)),
  listNamespacedCustomObject: (params, options) =>
    tryKube(() => customObjects.listNamespacedCustomObject(params, options)),
  patchClusterCustomObject: (params, options) =>
    tryKube(() => customObjects.patchClusterCustomObject(params, options)),
  patchNamespacedCustomObject: (params, options) =>
    tryKube(() => customObjects.patchNamespacedCustomObject(params, options)),
  replaceClusterCustomObject: (params, options) =>
    tryKube(() => customObjects.replaceClusterCustomObject(params, options)),
  replaceNamespacedCustomObject: (params, options) =>
    tryKube(() => customObjects.replaceNamespacedCustomObject(params, options)),
  deleteClusterCustomObject: (params, options) =>
    tryKubeOption(() => customObjects.deleteClusterCustomObject(params, options)),
  deleteNamespacedCustomObject: (params, options) =>
    tryKubeOption(() => customObjects.deleteNamespacedCustomObject(params, options)),
  deleteCollectionClusterCustomObject: (params, options) =>
    tryKube(() => customObjects.deleteCollectionClusterCustomObject(params, options)),
  deleteCollectionNamespacedCustomObject: (params, options) =>
    tryKube(() => customObjects.deleteCollectionNamespacedCustomObject(params, options)),
  getClusterCustomObjectStatus: (params, options) =>
    tryKubeOption(() => customObjects.getClusterCustomObjectStatus(params, options)),
  getNamespacedCustomObjectStatus: (params, options) =>
    tryKubeOption(() => customObjects.getNamespacedCustomObjectStatus(params, options)),
  patchClusterCustomObjectStatus: (params, options) =>
    tryKube(() => customObjects.patchClusterCustomObjectStatus(params, options)),
  patchNamespacedCustomObjectStatus: (params, options) =>
    tryKube(() => customObjects.patchNamespacedCustomObjectStatus(params, options)),
  replaceClusterCustomObjectStatus: (params, options) =>
    tryKube(() => customObjects.replaceClusterCustomObjectStatus(params, options)),
  replaceNamespacedCustomObjectStatus: (params, options) =>
    tryKube(() => customObjects.replaceNamespacedCustomObjectStatus(params, options)),
  getClusterCustomObjectScale: (params, options) =>
    tryKubeOption(() => customObjects.getClusterCustomObjectScale(params, options)),
  getNamespacedCustomObjectScale: (params, options) =>
    tryKubeOption(() => customObjects.getNamespacedCustomObjectScale(params, options)),
  patchClusterCustomObjectScale: (params, options) =>
    tryKube(() => customObjects.patchClusterCustomObjectScale(params, options)),
  patchNamespacedCustomObjectScale: (params, options) =>
    tryKube(() => customObjects.patchNamespacedCustomObjectScale(params, options)),
});
