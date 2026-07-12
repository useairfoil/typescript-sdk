import * as k8s from "@kubernetes/client-node";

import { access } from "../accessor";

/** Creates a cluster-scoped custom object using the `Kubernetes` service from context. */
export const createClusterCustomObject = <A extends k8s.KubernetesObject>(
  params: k8s.CustomObjectsApiCreateClusterCustomObjectRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.customObjects.createClusterCustomObject<A>(params, options));
/** Creates a namespaced custom object using the `Kubernetes` service from context. */
export const createNamespacedCustomObject = <A extends k8s.KubernetesObject>(
  params: k8s.CustomObjectsApiCreateNamespacedCustomObjectRequest,
  options?: k8s.ConfigurationOptions,
) =>
  access((kubernetes) => kubernetes.customObjects.createNamespacedCustomObject<A>(params, options));
/** Reads a cluster-scoped custom object from context, returning `Option.none` when it is not found. */
export const getClusterCustomObject = <A extends k8s.KubernetesObject>(
  params: k8s.CustomObjectsApiGetClusterCustomObjectRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.customObjects.getClusterCustomObject<A>(params, options));
/** Reads a namespaced custom object from context, returning `Option.none` when it is not found. */
export const getNamespacedCustomObject = <A extends k8s.KubernetesObject>(
  params: k8s.CustomObjectsApiGetNamespacedCustomObjectRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.customObjects.getNamespacedCustomObject<A>(params, options));
/** Lists cluster-scoped custom objects using the `Kubernetes` service from context. */
export const listClusterCustomObject = <A extends k8s.KubernetesObject>(
  params: k8s.CustomObjectsApiListClusterCustomObjectRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.customObjects.listClusterCustomObject<A>(params, options));
/** Lists namespaced custom objects across all Namespaces using the `Kubernetes` service from context. */
export const listCustomObjectForAllNamespaces = <A extends k8s.KubernetesObject>(
  params: k8s.CustomObjectsApiListCustomObjectForAllNamespacesRequest,
  options?: k8s.ConfigurationOptions,
) =>
  access((kubernetes) =>
    kubernetes.customObjects.listCustomObjectForAllNamespaces<A>(params, options),
  );
/** Lists custom objects in a Namespace using the `Kubernetes` service from context. */
export const listNamespacedCustomObject = <A extends k8s.KubernetesObject>(
  params: k8s.CustomObjectsApiListNamespacedCustomObjectRequest,
  options?: k8s.ConfigurationOptions,
) =>
  access((kubernetes) => kubernetes.customObjects.listNamespacedCustomObject<A>(params, options));
/** Patches a cluster-scoped custom object using the `Kubernetes` service from context. */
export const patchClusterCustomObject = <A extends k8s.KubernetesObject>(
  params: k8s.CustomObjectsApiPatchClusterCustomObjectRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.customObjects.patchClusterCustomObject<A>(params, options));
/** Patches a namespaced custom object using the `Kubernetes` service from context. */
export const patchNamespacedCustomObject = <A extends k8s.KubernetesObject>(
  params: k8s.CustomObjectsApiPatchNamespacedCustomObjectRequest,
  options?: k8s.ConfigurationOptions,
) =>
  access((kubernetes) => kubernetes.customObjects.patchNamespacedCustomObject<A>(params, options));
/** Replaces a cluster-scoped custom object using the `Kubernetes` service from context. */
export const replaceClusterCustomObject = <A extends k8s.KubernetesObject>(
  params: k8s.CustomObjectsApiReplaceClusterCustomObjectRequest,
  options?: k8s.ConfigurationOptions,
) =>
  access((kubernetes) => kubernetes.customObjects.replaceClusterCustomObject<A>(params, options));
/** Replaces a namespaced custom object using the `Kubernetes` service from context. */
export const replaceNamespacedCustomObject = <A extends k8s.KubernetesObject>(
  params: k8s.CustomObjectsApiReplaceNamespacedCustomObjectRequest,
  options?: k8s.ConfigurationOptions,
) =>
  access((kubernetes) =>
    kubernetes.customObjects.replaceNamespacedCustomObject<A>(params, options),
  );
/** Deletes a cluster-scoped custom object from context, returning `Option.none` when it is already absent. */
export const deleteClusterCustomObject = <A = unknown>(
  params: k8s.CustomObjectsApiDeleteClusterCustomObjectRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.customObjects.deleteClusterCustomObject<A>(params, options));
/** Deletes a namespaced custom object from context, returning `Option.none` when it is already absent. */
export const deleteNamespacedCustomObject = <A = unknown>(
  params: k8s.CustomObjectsApiDeleteNamespacedCustomObjectRequest,
  options?: k8s.ConfigurationOptions,
) =>
  access((kubernetes) => kubernetes.customObjects.deleteNamespacedCustomObject<A>(params, options));
/** Deletes a collection of cluster-scoped custom objects using the `Kubernetes` service from context. */
export const deleteCollectionClusterCustomObject = <A = unknown>(
  params: k8s.CustomObjectsApiDeleteCollectionClusterCustomObjectRequest,
  options?: k8s.ConfigurationOptions,
) =>
  access((kubernetes) =>
    kubernetes.customObjects.deleteCollectionClusterCustomObject<A>(params, options),
  );
/** Deletes a collection of namespaced custom objects using the `Kubernetes` service from context. */
export const deleteCollectionNamespacedCustomObject = <A = unknown>(
  params: k8s.CustomObjectsApiDeleteCollectionNamespacedCustomObjectRequest,
  options?: k8s.ConfigurationOptions,
) =>
  access((kubernetes) =>
    kubernetes.customObjects.deleteCollectionNamespacedCustomObject<A>(params, options),
  );
/** Reads cluster-scoped custom object status from context, returning `Option.none` when it is not found. */
export const getClusterCustomObjectStatus = <A extends k8s.KubernetesObject>(
  params: k8s.CustomObjectsApiGetClusterCustomObjectStatusRequest,
  options?: k8s.ConfigurationOptions,
) =>
  access((kubernetes) => kubernetes.customObjects.getClusterCustomObjectStatus<A>(params, options));
/** Reads namespaced custom object status from context, returning `Option.none` when it is not found. */
export const getNamespacedCustomObjectStatus = <A extends k8s.KubernetesObject>(
  params: k8s.CustomObjectsApiGetNamespacedCustomObjectStatusRequest,
  options?: k8s.ConfigurationOptions,
) =>
  access((kubernetes) =>
    kubernetes.customObjects.getNamespacedCustomObjectStatus<A>(params, options),
  );
/** Patches cluster-scoped custom object status using the `Kubernetes` service from context. */
export const patchClusterCustomObjectStatus = <A extends k8s.KubernetesObject>(
  params: k8s.CustomObjectsApiPatchClusterCustomObjectStatusRequest,
  options?: k8s.ConfigurationOptions,
) =>
  access((kubernetes) =>
    kubernetes.customObjects.patchClusterCustomObjectStatus<A>(params, options),
  );
/** Patches namespaced custom object status using the `Kubernetes` service from context. */
export const patchNamespacedCustomObjectStatus = <A extends k8s.KubernetesObject>(
  params: k8s.CustomObjectsApiPatchNamespacedCustomObjectStatusRequest,
  options?: k8s.ConfigurationOptions,
) =>
  access((kubernetes) =>
    kubernetes.customObjects.patchNamespacedCustomObjectStatus<A>(params, options),
  );
/** Replaces cluster-scoped custom object status using the `Kubernetes` service from context. */
export const replaceClusterCustomObjectStatus = <A extends k8s.KubernetesObject>(
  params: k8s.CustomObjectsApiReplaceClusterCustomObjectStatusRequest,
  options?: k8s.ConfigurationOptions,
) =>
  access((kubernetes) =>
    kubernetes.customObjects.replaceClusterCustomObjectStatus<A>(params, options),
  );
/** Replaces namespaced custom object status using the `Kubernetes` service from context. */
export const replaceNamespacedCustomObjectStatus = <A extends k8s.KubernetesObject>(
  params: k8s.CustomObjectsApiReplaceNamespacedCustomObjectStatusRequest,
  options?: k8s.ConfigurationOptions,
) =>
  access((kubernetes) =>
    kubernetes.customObjects.replaceNamespacedCustomObjectStatus<A>(params, options),
  );
/** Reads cluster-scoped custom object scale from context, returning `Option.none` when it is not found. */
export const getClusterCustomObjectScale = <A extends k8s.KubernetesObject>(
  params: k8s.CustomObjectsApiGetClusterCustomObjectScaleRequest,
  options?: k8s.ConfigurationOptions,
) =>
  access((kubernetes) => kubernetes.customObjects.getClusterCustomObjectScale<A>(params, options));
/** Reads namespaced custom object scale from context, returning `Option.none` when it is not found. */
export const getNamespacedCustomObjectScale = <A extends k8s.KubernetesObject>(
  params: k8s.CustomObjectsApiGetNamespacedCustomObjectScaleRequest,
  options?: k8s.ConfigurationOptions,
) =>
  access((kubernetes) =>
    kubernetes.customObjects.getNamespacedCustomObjectScale<A>(params, options),
  );
/** Patches cluster-scoped custom object scale using the `Kubernetes` service from context. */
export const patchClusterCustomObjectScale = <A extends k8s.KubernetesObject>(
  params: k8s.CustomObjectsApiPatchClusterCustomObjectScaleRequest,
  options?: k8s.ConfigurationOptions,
) =>
  access((kubernetes) =>
    kubernetes.customObjects.patchClusterCustomObjectScale<A>(params, options),
  );
/** Patches namespaced custom object scale using the `Kubernetes` service from context. */
export const patchNamespacedCustomObjectScale = <A extends k8s.KubernetesObject>(
  params: k8s.CustomObjectsApiPatchNamespacedCustomObjectScaleRequest,
  options?: k8s.ConfigurationOptions,
) =>
  access((kubernetes) =>
    kubernetes.customObjects.patchNamespacedCustomObjectScale<A>(params, options),
  );
