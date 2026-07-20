import * as k8s from "@kubernetes/client-node";

import { access } from "../accessor";

/** Creates a Deployment in a Namespace using the `Kubernetes` service from context. */
export const createNamespacedDeployment = (
  params: k8s.AppsV1ApiCreateNamespacedDeploymentRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.apps.createNamespacedDeployment(params, options));
/** Reads a Deployment from context, returning `Option.none` when it is not found. */
export const readNamespacedDeployment = (
  params: k8s.AppsV1ApiReadNamespacedDeploymentRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.apps.readNamespacedDeployment(params, options));
/** Patches a Deployment using the `Kubernetes` service from context. */
export const patchNamespacedDeployment = (
  params: k8s.AppsV1ApiPatchNamespacedDeploymentRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.apps.patchNamespacedDeployment(params, options));
/** Deletes a Deployment from context, returning `Option.none` when it is already absent. */
export const deleteNamespacedDeployment = (
  params: k8s.AppsV1ApiDeleteNamespacedDeploymentRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.apps.deleteNamespacedDeployment(params, options));
/** Lists Deployments in a Namespace using the `Kubernetes` service from context. */
export const listNamespacedDeployment = (
  params: k8s.AppsV1ApiListNamespacedDeploymentRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.apps.listNamespacedDeployment(params, options));
/** Reads Deployment status from context, returning `Option.none` when it is not found. */
export const readNamespacedDeploymentStatus = (
  params: k8s.AppsV1ApiReadNamespacedDeploymentStatusRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.apps.readNamespacedDeploymentStatus(params, options));
/** Patches Deployment status using the `Kubernetes` service from context. */
export const patchNamespacedDeploymentStatus = (
  params: k8s.AppsV1ApiPatchNamespacedDeploymentStatusRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.apps.patchNamespacedDeploymentStatus(params, options));
/** Lists ReplicaSets in a Namespace using the `Kubernetes` service from context. */
export const listNamespacedReplicaSet = (
  params: k8s.AppsV1ApiListNamespacedReplicaSetRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.apps.listNamespacedReplicaSet(params, options));
/** Reads a ReplicaSet from context, returning `Option.none` when it is not found. */
export const readNamespacedReplicaSet = (
  params: k8s.AppsV1ApiReadNamespacedReplicaSetRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.apps.readNamespacedReplicaSet(params, options));
