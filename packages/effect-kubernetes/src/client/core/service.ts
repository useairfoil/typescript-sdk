import * as k8s from "@kubernetes/client-node";

import type { CoreResult, KubeEffect, KubeOptionEffect } from "../types";

import { tryKube, tryKubeOption } from "../helpers";

/** Effect wrappers for selected Kubernetes CoreV1 operations. */
export interface Service {
  /** Creates a Namespace. */
  readonly createNamespace: (
    params: k8s.CoreV1ApiCreateNamespaceRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeEffect<CoreResult<"createNamespace">>;
  /** Reads a Namespace, returning `Option.none` when it is not found. */
  readonly readNamespace: (
    params: k8s.CoreV1ApiReadNamespaceRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeOptionEffect<CoreResult<"readNamespace">>;
  /** Patches a Namespace. */
  readonly patchNamespace: (
    params: k8s.CoreV1ApiPatchNamespaceRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeEffect<CoreResult<"patchNamespace">>;
  /** Deletes a Namespace, returning `Option.none` when it is already absent. */
  readonly deleteNamespace: (
    params: k8s.CoreV1ApiDeleteNamespaceRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeOptionEffect<CoreResult<"deleteNamespace">>;
  /** Lists Namespaces. */
  readonly listNamespace: (
    params?: k8s.CoreV1ApiListNamespaceRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeEffect<CoreResult<"listNamespace">>;

  /** Creates a Pod in a Namespace. */
  readonly createNamespacedPod: (
    params: k8s.CoreV1ApiCreateNamespacedPodRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeEffect<CoreResult<"createNamespacedPod">>;
  /** Reads a Pod, returning `Option.none` when it is not found. */
  readonly readNamespacedPod: (
    params: k8s.CoreV1ApiReadNamespacedPodRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeOptionEffect<CoreResult<"readNamespacedPod">>;
  /** Patches a Pod. */
  readonly patchNamespacedPod: (
    params: k8s.CoreV1ApiPatchNamespacedPodRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeEffect<CoreResult<"patchNamespacedPod">>;
  /** Deletes a Pod, returning `Option.none` when it is already absent. */
  readonly deleteNamespacedPod: (
    params: k8s.CoreV1ApiDeleteNamespacedPodRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeOptionEffect<CoreResult<"deleteNamespacedPod">>;
  /** Lists Pods in a Namespace. */
  readonly listNamespacedPod: (
    params: k8s.CoreV1ApiListNamespacedPodRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeEffect<CoreResult<"listNamespacedPod">>;
  /** Reads Pod logs as a single response. */
  readonly readNamespacedPodLog: (
    params: k8s.CoreV1ApiReadNamespacedPodLogRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeEffect<CoreResult<"readNamespacedPodLog">>;

  /** Creates a Secret in a Namespace. */
  readonly createNamespacedSecret: (
    params: k8s.CoreV1ApiCreateNamespacedSecretRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeEffect<CoreResult<"createNamespacedSecret">>;
  /** Reads a Secret, returning `Option.none` when it is not found. */
  readonly readNamespacedSecret: (
    params: k8s.CoreV1ApiReadNamespacedSecretRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeOptionEffect<CoreResult<"readNamespacedSecret">>;
  /** Patches a Secret. */
  readonly patchNamespacedSecret: (
    params: k8s.CoreV1ApiPatchNamespacedSecretRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeEffect<CoreResult<"patchNamespacedSecret">>;
  /** Deletes a Secret, returning `Option.none` when it is already absent. */
  readonly deleteNamespacedSecret: (
    params: k8s.CoreV1ApiDeleteNamespacedSecretRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeOptionEffect<CoreResult<"deleteNamespacedSecret">>;
  /** Lists Secrets in a Namespace. */
  readonly listNamespacedSecret: (
    params: k8s.CoreV1ApiListNamespacedSecretRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeEffect<CoreResult<"listNamespacedSecret">>;

  /** Creates a ConfigMap in a Namespace. */
  readonly createNamespacedConfigMap: (
    params: k8s.CoreV1ApiCreateNamespacedConfigMapRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeEffect<CoreResult<"createNamespacedConfigMap">>;
  /** Reads a ConfigMap, returning `Option.none` when it is not found. */
  readonly readNamespacedConfigMap: (
    params: k8s.CoreV1ApiReadNamespacedConfigMapRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeOptionEffect<CoreResult<"readNamespacedConfigMap">>;
  /** Patches a ConfigMap. */
  readonly patchNamespacedConfigMap: (
    params: k8s.CoreV1ApiPatchNamespacedConfigMapRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeEffect<CoreResult<"patchNamespacedConfigMap">>;
  /** Deletes a ConfigMap, returning `Option.none` when it is already absent. */
  readonly deleteNamespacedConfigMap: (
    params: k8s.CoreV1ApiDeleteNamespacedConfigMapRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeOptionEffect<CoreResult<"deleteNamespacedConfigMap">>;
  /** Lists ConfigMaps in a Namespace. */
  readonly listNamespacedConfigMap: (
    params: k8s.CoreV1ApiListNamespacedConfigMapRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeEffect<CoreResult<"listNamespacedConfigMap">>;

  /** Creates a Service in a Namespace. */
  readonly createNamespacedService: (
    params: k8s.CoreV1ApiCreateNamespacedServiceRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeEffect<CoreResult<"createNamespacedService">>;
  /** Reads a Service, returning `Option.none` when it is not found. */
  readonly readNamespacedService: (
    params: k8s.CoreV1ApiReadNamespacedServiceRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeOptionEffect<CoreResult<"readNamespacedService">>;
  /** Patches a Service. */
  readonly patchNamespacedService: (
    params: k8s.CoreV1ApiPatchNamespacedServiceRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeEffect<CoreResult<"patchNamespacedService">>;
  /** Deletes a Service, returning `Option.none` when it is already absent. */
  readonly deleteNamespacedService: (
    params: k8s.CoreV1ApiDeleteNamespacedServiceRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeOptionEffect<CoreResult<"deleteNamespacedService">>;
  /** Lists Services in a Namespace. */
  readonly listNamespacedService: (
    params: k8s.CoreV1ApiListNamespacedServiceRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeEffect<CoreResult<"listNamespacedService">>;

  /** Creates a ServiceAccount in a Namespace. */
  readonly createNamespacedServiceAccount: (
    params: k8s.CoreV1ApiCreateNamespacedServiceAccountRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeEffect<CoreResult<"createNamespacedServiceAccount">>;
  /** Reads a ServiceAccount, returning `Option.none` when it is not found. */
  readonly readNamespacedServiceAccount: (
    params: k8s.CoreV1ApiReadNamespacedServiceAccountRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeOptionEffect<CoreResult<"readNamespacedServiceAccount">>;
  /** Patches a ServiceAccount. */
  readonly patchNamespacedServiceAccount: (
    params: k8s.CoreV1ApiPatchNamespacedServiceAccountRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeEffect<CoreResult<"patchNamespacedServiceAccount">>;
  /** Deletes a ServiceAccount, returning `Option.none` when it is already absent. */
  readonly deleteNamespacedServiceAccount: (
    params: k8s.CoreV1ApiDeleteNamespacedServiceAccountRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeOptionEffect<CoreResult<"deleteNamespacedServiceAccount">>;
  /** Lists ServiceAccounts in a Namespace. */
  readonly listNamespacedServiceAccount: (
    params: k8s.CoreV1ApiListNamespacedServiceAccountRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeEffect<CoreResult<"listNamespacedServiceAccount">>;

  /** Lists Events in a Namespace. */
  readonly listNamespacedEvent: (
    params: k8s.CoreV1ApiListNamespacedEventRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeEffect<CoreResult<"listNamespacedEvent">>;
}

/** Creates CoreV1 operation wrappers from an upstream Kubernetes CoreV1 API client. */
export const make = (core: k8s.CoreV1Api): Service => ({
  createNamespace: (params, options) => tryKube(() => core.createNamespace(params, options)),
  readNamespace: (params, options) => tryKubeOption(() => core.readNamespace(params, options)),
  patchNamespace: (params, options) => tryKube(() => core.patchNamespace(params, options)),
  deleteNamespace: (params, options) => tryKubeOption(() => core.deleteNamespace(params, options)),
  listNamespace: (params = {}, options) => tryKube(() => core.listNamespace(params, options)),

  createNamespacedPod: (params, options) =>
    tryKube(() => core.createNamespacedPod(params, options)),
  readNamespacedPod: (params, options) =>
    tryKubeOption(() => core.readNamespacedPod(params, options)),
  patchNamespacedPod: (params, options) => tryKube(() => core.patchNamespacedPod(params, options)),
  deleteNamespacedPod: (params, options) =>
    tryKubeOption(() => core.deleteNamespacedPod(params, options)),
  listNamespacedPod: (params, options) => tryKube(() => core.listNamespacedPod(params, options)),
  readNamespacedPodLog: (params, options) =>
    tryKube(() => core.readNamespacedPodLog(params, options)),

  createNamespacedSecret: (params, options) =>
    tryKube(() => core.createNamespacedSecret(params, options)),
  readNamespacedSecret: (params, options) =>
    tryKubeOption(() => core.readNamespacedSecret(params, options)),
  patchNamespacedSecret: (params, options) =>
    tryKube(() => core.patchNamespacedSecret(params, options)),
  deleteNamespacedSecret: (params, options) =>
    tryKubeOption(() => core.deleteNamespacedSecret(params, options)),
  listNamespacedSecret: (params, options) =>
    tryKube(() => core.listNamespacedSecret(params, options)),

  createNamespacedConfigMap: (params, options) =>
    tryKube(() => core.createNamespacedConfigMap(params, options)),
  readNamespacedConfigMap: (params, options) =>
    tryKubeOption(() => core.readNamespacedConfigMap(params, options)),
  patchNamespacedConfigMap: (params, options) =>
    tryKube(() => core.patchNamespacedConfigMap(params, options)),
  deleteNamespacedConfigMap: (params, options) =>
    tryKubeOption(() => core.deleteNamespacedConfigMap(params, options)),
  listNamespacedConfigMap: (params, options) =>
    tryKube(() => core.listNamespacedConfigMap(params, options)),

  createNamespacedService: (params, options) =>
    tryKube(() => core.createNamespacedService(params, options)),
  readNamespacedService: (params, options) =>
    tryKubeOption(() => core.readNamespacedService(params, options)),
  patchNamespacedService: (params, options) =>
    tryKube(() => core.patchNamespacedService(params, options)),
  deleteNamespacedService: (params, options) =>
    tryKubeOption(() => core.deleteNamespacedService(params, options)),
  listNamespacedService: (params, options) =>
    tryKube(() => core.listNamespacedService(params, options)),

  createNamespacedServiceAccount: (params, options) =>
    tryKube(() => core.createNamespacedServiceAccount(params, options)),
  readNamespacedServiceAccount: (params, options) =>
    tryKubeOption(() => core.readNamespacedServiceAccount(params, options)),
  patchNamespacedServiceAccount: (params, options) =>
    tryKube(() => core.patchNamespacedServiceAccount(params, options)),
  deleteNamespacedServiceAccount: (params, options) =>
    tryKubeOption(() => core.deleteNamespacedServiceAccount(params, options)),
  listNamespacedServiceAccount: (params, options) =>
    tryKube(() => core.listNamespacedServiceAccount(params, options)),

  listNamespacedEvent: (params, options) =>
    tryKube(() => core.listNamespacedEvent(params, options)),
});
