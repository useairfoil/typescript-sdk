import * as k8s from "@kubernetes/client-node";

import { access } from "../accessor";

/** Creates an Ingress in a Namespace using the `Kubernetes` service from context. */
export const createNamespacedIngress = (
  params: k8s.NetworkingV1ApiCreateNamespacedIngressRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.networking.createNamespacedIngress(params, options));
/** Reads an Ingress from context, returning `Option.none` when it is not found. */
export const readNamespacedIngress = (
  params: k8s.NetworkingV1ApiReadNamespacedIngressRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.networking.readNamespacedIngress(params, options));
/** Patches an Ingress using the `Kubernetes` service from context. */
export const patchNamespacedIngress = (
  params: k8s.NetworkingV1ApiPatchNamespacedIngressRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.networking.patchNamespacedIngress(params, options));
/** Deletes an Ingress from context, returning `Option.none` when it is already absent. */
export const deleteNamespacedIngress = (
  params: k8s.NetworkingV1ApiDeleteNamespacedIngressRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.networking.deleteNamespacedIngress(params, options));
/** Lists Ingresses in a Namespace using the `Kubernetes` service from context. */
export const listNamespacedIngress = (
  params: k8s.NetworkingV1ApiListNamespacedIngressRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.networking.listNamespacedIngress(params, options));
