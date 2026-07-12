import * as k8s from "@kubernetes/client-node";

import type { AppsResult, KubeEffect, KubeOptionEffect } from "../types";

import { tryKube, tryKubeOption } from "../helpers";

/** Effect wrappers for selected Kubernetes AppsV1 operations. */
export interface Service {
  /** Creates a Deployment in a Namespace. */
  readonly createNamespacedDeployment: (
    params: k8s.AppsV1ApiCreateNamespacedDeploymentRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeEffect<AppsResult<"createNamespacedDeployment">>;
  /** Reads a Deployment, returning `Option.none` when it is not found. */
  readonly readNamespacedDeployment: (
    params: k8s.AppsV1ApiReadNamespacedDeploymentRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeOptionEffect<AppsResult<"readNamespacedDeployment">>;
  /** Patches a Deployment. */
  readonly patchNamespacedDeployment: (
    params: k8s.AppsV1ApiPatchNamespacedDeploymentRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeEffect<AppsResult<"patchNamespacedDeployment">>;
  /** Deletes a Deployment, returning `Option.none` when it is already absent. */
  readonly deleteNamespacedDeployment: (
    params: k8s.AppsV1ApiDeleteNamespacedDeploymentRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeOptionEffect<AppsResult<"deleteNamespacedDeployment">>;
  /** Lists Deployments in a Namespace. */
  readonly listNamespacedDeployment: (
    params: k8s.AppsV1ApiListNamespacedDeploymentRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeEffect<AppsResult<"listNamespacedDeployment">>;
  /** Reads Deployment status, returning `Option.none` when it is not found. */
  readonly readNamespacedDeploymentStatus: (
    params: k8s.AppsV1ApiReadNamespacedDeploymentStatusRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeOptionEffect<AppsResult<"readNamespacedDeploymentStatus">>;
  /** Patches Deployment status. */
  readonly patchNamespacedDeploymentStatus: (
    params: k8s.AppsV1ApiPatchNamespacedDeploymentStatusRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeEffect<AppsResult<"patchNamespacedDeploymentStatus">>;
  /** Lists ReplicaSets in a Namespace. */
  readonly listNamespacedReplicaSet: (
    params: k8s.AppsV1ApiListNamespacedReplicaSetRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeEffect<AppsResult<"listNamespacedReplicaSet">>;
  /** Reads a ReplicaSet, returning `Option.none` when it is not found. */
  readonly readNamespacedReplicaSet: (
    params: k8s.AppsV1ApiReadNamespacedReplicaSetRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeOptionEffect<AppsResult<"readNamespacedReplicaSet">>;
}

/** Creates AppsV1 operation wrappers from an upstream Kubernetes AppsV1 API client. */
export const make = (apps: k8s.AppsV1Api): Service => ({
  createNamespacedDeployment: (params, options) =>
    tryKube(() => apps.createNamespacedDeployment(params, options)),
  readNamespacedDeployment: (params, options) =>
    tryKubeOption(() => apps.readNamespacedDeployment(params, options)),
  patchNamespacedDeployment: (params, options) =>
    tryKube(() => apps.patchNamespacedDeployment(params, options)),
  deleteNamespacedDeployment: (params, options) =>
    tryKubeOption(() => apps.deleteNamespacedDeployment(params, options)),
  listNamespacedDeployment: (params, options) =>
    tryKube(() => apps.listNamespacedDeployment(params, options)),
  readNamespacedDeploymentStatus: (params, options) =>
    tryKubeOption(() => apps.readNamespacedDeploymentStatus(params, options)),
  patchNamespacedDeploymentStatus: (params, options) =>
    tryKube(() => apps.patchNamespacedDeploymentStatus(params, options)),
  listNamespacedReplicaSet: (params, options) =>
    tryKube(() => apps.listNamespacedReplicaSet(params, options)),
  readNamespacedReplicaSet: (params, options) =>
    tryKubeOption(() => apps.readNamespacedReplicaSet(params, options)),
});
