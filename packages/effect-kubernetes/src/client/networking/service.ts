import * as k8s from "@kubernetes/client-node";

import type { KubeEffect, KubeOptionEffect, NetworkingResult } from "../types";

import { tryKube, tryKubeOption } from "../helpers";

/** Effect wrappers for selected Kubernetes NetworkingV1 operations. */
export interface Service {
  /** Creates an Ingress in a Namespace. */
  readonly createNamespacedIngress: (
    params: k8s.NetworkingV1ApiCreateNamespacedIngressRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeEffect<NetworkingResult<"createNamespacedIngress">>;
  /** Reads an Ingress, returning `Option.none` when it is not found. */
  readonly readNamespacedIngress: (
    params: k8s.NetworkingV1ApiReadNamespacedIngressRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeOptionEffect<NetworkingResult<"readNamespacedIngress">>;
  /** Patches an Ingress. */
  readonly patchNamespacedIngress: (
    params: k8s.NetworkingV1ApiPatchNamespacedIngressRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeEffect<NetworkingResult<"patchNamespacedIngress">>;
  /** Deletes an Ingress, returning `Option.none` when it is already absent. */
  readonly deleteNamespacedIngress: (
    params: k8s.NetworkingV1ApiDeleteNamespacedIngressRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeOptionEffect<NetworkingResult<"deleteNamespacedIngress">>;
  /** Lists Ingresses in a Namespace. */
  readonly listNamespacedIngress: (
    params: k8s.NetworkingV1ApiListNamespacedIngressRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeEffect<NetworkingResult<"listNamespacedIngress">>;
}

/** Creates NetworkingV1 operation wrappers from an upstream Kubernetes NetworkingV1 API client. */
export const make = (networking: k8s.NetworkingV1Api): Service => ({
  createNamespacedIngress: (params, options) =>
    tryKube(() => networking.createNamespacedIngress(params, options)),
  readNamespacedIngress: (params, options) =>
    tryKubeOption(() => networking.readNamespacedIngress(params, options)),
  patchNamespacedIngress: (params, options) =>
    tryKube(() => networking.patchNamespacedIngress(params, options)),
  deleteNamespacedIngress: (params, options) =>
    tryKubeOption(() => networking.deleteNamespacedIngress(params, options)),
  listNamespacedIngress: (params, options) =>
    tryKube(() => networking.listNamespacedIngress(params, options)),
});
