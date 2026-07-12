import * as k8s from "@kubernetes/client-node";
import { Effect, Stream } from "effect";

import type { KubernetesError } from "../../errors";
import type { Kubernetes } from "../context";
import type { PodLogStreamRequest } from "../service";

import { access, service } from "../accessor";

/** Creates a Namespace using the `Kubernetes` service from context. */
export const createNamespace = (
  params: k8s.CoreV1ApiCreateNamespaceRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.core.createNamespace(params, options));
/** Reads a Namespace from context, returning `Option.none` when it is not found. */
export const readNamespace = (
  params: k8s.CoreV1ApiReadNamespaceRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.core.readNamespace(params, options));
/** Patches a Namespace using the `Kubernetes` service from context. */
export const patchNamespace = (
  params: k8s.CoreV1ApiPatchNamespaceRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.core.patchNamespace(params, options));
/** Deletes a Namespace from context, returning `Option.none` when it is already absent. */
export const deleteNamespace = (
  params: k8s.CoreV1ApiDeleteNamespaceRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.core.deleteNamespace(params, options));
/** Lists Namespaces using the `Kubernetes` service from context. */
export const listNamespace = (
  params?: k8s.CoreV1ApiListNamespaceRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.core.listNamespace(params, options));

/** Creates a Pod in a Namespace using the `Kubernetes` service from context. */
export const createNamespacedPod = (
  params: k8s.CoreV1ApiCreateNamespacedPodRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.core.createNamespacedPod(params, options));
/** Reads a Pod from context, returning `Option.none` when it is not found. */
export const readNamespacedPod = (
  params: k8s.CoreV1ApiReadNamespacedPodRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.core.readNamespacedPod(params, options));
/** Patches a Pod using the `Kubernetes` service from context. */
export const patchNamespacedPod = (
  params: k8s.CoreV1ApiPatchNamespacedPodRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.core.patchNamespacedPod(params, options));
/** Deletes a Pod from context, returning `Option.none` when it is already absent. */
export const deleteNamespacedPod = (
  params: k8s.CoreV1ApiDeleteNamespacedPodRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.core.deleteNamespacedPod(params, options));
/** Lists Pods in a Namespace using the `Kubernetes` service from context. */
export const listNamespacedPod = (
  params: k8s.CoreV1ApiListNamespacedPodRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.core.listNamespacedPod(params, options));
/** Reads Pod logs as a single response using the `Kubernetes` service from context. */
export const readNamespacedPodLog = (
  params: k8s.CoreV1ApiReadNamespacedPodLogRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.core.readNamespacedPodLog(params, options));
/** Streams Pod log chunks using the `Kubernetes` service from context. */
export const streamNamespacedPodLog = (
  params: PodLogStreamRequest,
): Stream.Stream<string, KubernetesError, Kubernetes> =>
  Stream.unwrap(
    Effect.map(service, (kubernetes) => kubernetes.logs.streamNamespacedPodLog(params)),
  );

/** Creates a Secret in a Namespace using the `Kubernetes` service from context. */
export const createNamespacedSecret = (
  params: k8s.CoreV1ApiCreateNamespacedSecretRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.core.createNamespacedSecret(params, options));
/** Reads a Secret from context, returning `Option.none` when it is not found. */
export const readNamespacedSecret = (
  params: k8s.CoreV1ApiReadNamespacedSecretRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.core.readNamespacedSecret(params, options));
/** Patches a Secret using the `Kubernetes` service from context. */
export const patchNamespacedSecret = (
  params: k8s.CoreV1ApiPatchNamespacedSecretRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.core.patchNamespacedSecret(params, options));
/** Deletes a Secret from context, returning `Option.none` when it is already absent. */
export const deleteNamespacedSecret = (
  params: k8s.CoreV1ApiDeleteNamespacedSecretRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.core.deleteNamespacedSecret(params, options));
/** Lists Secrets in a Namespace using the `Kubernetes` service from context. */
export const listNamespacedSecret = (
  params: k8s.CoreV1ApiListNamespacedSecretRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.core.listNamespacedSecret(params, options));

/** Creates a ConfigMap in a Namespace using the `Kubernetes` service from context. */
export const createNamespacedConfigMap = (
  params: k8s.CoreV1ApiCreateNamespacedConfigMapRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.core.createNamespacedConfigMap(params, options));
/** Reads a ConfigMap from context, returning `Option.none` when it is not found. */
export const readNamespacedConfigMap = (
  params: k8s.CoreV1ApiReadNamespacedConfigMapRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.core.readNamespacedConfigMap(params, options));
/** Patches a ConfigMap using the `Kubernetes` service from context. */
export const patchNamespacedConfigMap = (
  params: k8s.CoreV1ApiPatchNamespacedConfigMapRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.core.patchNamespacedConfigMap(params, options));
/** Deletes a ConfigMap from context, returning `Option.none` when it is already absent. */
export const deleteNamespacedConfigMap = (
  params: k8s.CoreV1ApiDeleteNamespacedConfigMapRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.core.deleteNamespacedConfigMap(params, options));
/** Lists ConfigMaps in a Namespace using the `Kubernetes` service from context. */
export const listNamespacedConfigMap = (
  params: k8s.CoreV1ApiListNamespacedConfigMapRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.core.listNamespacedConfigMap(params, options));

/** Creates a Service in a Namespace using the `Kubernetes` service from context. */
export const createNamespacedService = (
  params: k8s.CoreV1ApiCreateNamespacedServiceRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.core.createNamespacedService(params, options));
/** Reads a Service from context, returning `Option.none` when it is not found. */
export const readNamespacedService = (
  params: k8s.CoreV1ApiReadNamespacedServiceRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.core.readNamespacedService(params, options));
/** Patches a Service using the `Kubernetes` service from context. */
export const patchNamespacedService = (
  params: k8s.CoreV1ApiPatchNamespacedServiceRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.core.patchNamespacedService(params, options));
/** Deletes a Service from context, returning `Option.none` when it is already absent. */
export const deleteNamespacedService = (
  params: k8s.CoreV1ApiDeleteNamespacedServiceRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.core.deleteNamespacedService(params, options));
/** Lists Services in a Namespace using the `Kubernetes` service from context. */
export const listNamespacedService = (
  params: k8s.CoreV1ApiListNamespacedServiceRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.core.listNamespacedService(params, options));

/** Creates a ServiceAccount in a Namespace using the `Kubernetes` service from context. */
export const createNamespacedServiceAccount = (
  params: k8s.CoreV1ApiCreateNamespacedServiceAccountRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.core.createNamespacedServiceAccount(params, options));
/** Reads a ServiceAccount from context, returning `Option.none` when it is not found. */
export const readNamespacedServiceAccount = (
  params: k8s.CoreV1ApiReadNamespacedServiceAccountRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.core.readNamespacedServiceAccount(params, options));
/** Patches a ServiceAccount using the `Kubernetes` service from context. */
export const patchNamespacedServiceAccount = (
  params: k8s.CoreV1ApiPatchNamespacedServiceAccountRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.core.patchNamespacedServiceAccount(params, options));
/** Deletes a ServiceAccount from context, returning `Option.none` when it is already absent. */
export const deleteNamespacedServiceAccount = (
  params: k8s.CoreV1ApiDeleteNamespacedServiceAccountRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.core.deleteNamespacedServiceAccount(params, options));
/** Lists ServiceAccounts in a Namespace using the `Kubernetes` service from context. */
export const listNamespacedServiceAccount = (
  params: k8s.CoreV1ApiListNamespacedServiceAccountRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.core.listNamespacedServiceAccount(params, options));
/** Lists Events in a Namespace using the `Kubernetes` service from context. */
export const listNamespacedEvent = (
  params: k8s.CoreV1ApiListNamespacedEventRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.core.listNamespacedEvent(params, options));
