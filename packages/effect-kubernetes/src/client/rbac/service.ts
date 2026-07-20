import * as k8s from "@kubernetes/client-node";

import type { KubeEffect, KubeOptionEffect, RbacResult } from "../types";

import { tryKube, tryKubeOption } from "../helpers";

/** Effect wrappers for selected Kubernetes RbacAuthorizationV1 operations. */
export interface Service {
  /** Creates a Role in a Namespace. */
  readonly createNamespacedRole: (
    params: k8s.RbacAuthorizationV1ApiCreateNamespacedRoleRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeEffect<RbacResult<"createNamespacedRole">>;
  /** Reads a Role, returning `Option.none` when it is not found. */
  readonly readNamespacedRole: (
    params: k8s.RbacAuthorizationV1ApiReadNamespacedRoleRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeOptionEffect<RbacResult<"readNamespacedRole">>;
  /** Patches a Role. */
  readonly patchNamespacedRole: (
    params: k8s.RbacAuthorizationV1ApiPatchNamespacedRoleRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeEffect<RbacResult<"patchNamespacedRole">>;
  /** Deletes a Role, returning `Option.none` when it is already absent. */
  readonly deleteNamespacedRole: (
    params: k8s.RbacAuthorizationV1ApiDeleteNamespacedRoleRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeOptionEffect<RbacResult<"deleteNamespacedRole">>;
  /** Lists Roles in a Namespace. */
  readonly listNamespacedRole: (
    params: k8s.RbacAuthorizationV1ApiListNamespacedRoleRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeEffect<RbacResult<"listNamespacedRole">>;
  /** Creates a RoleBinding in a Namespace. */
  readonly createNamespacedRoleBinding: (
    params: k8s.RbacAuthorizationV1ApiCreateNamespacedRoleBindingRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeEffect<RbacResult<"createNamespacedRoleBinding">>;
  /** Reads a RoleBinding, returning `Option.none` when it is not found. */
  readonly readNamespacedRoleBinding: (
    params: k8s.RbacAuthorizationV1ApiReadNamespacedRoleBindingRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeOptionEffect<RbacResult<"readNamespacedRoleBinding">>;
  /** Patches a RoleBinding. */
  readonly patchNamespacedRoleBinding: (
    params: k8s.RbacAuthorizationV1ApiPatchNamespacedRoleBindingRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeEffect<RbacResult<"patchNamespacedRoleBinding">>;
  /** Deletes a RoleBinding, returning `Option.none` when it is already absent. */
  readonly deleteNamespacedRoleBinding: (
    params: k8s.RbacAuthorizationV1ApiDeleteNamespacedRoleBindingRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeOptionEffect<RbacResult<"deleteNamespacedRoleBinding">>;
  /** Lists RoleBindings in a Namespace. */
  readonly listNamespacedRoleBinding: (
    params: k8s.RbacAuthorizationV1ApiListNamespacedRoleBindingRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeEffect<RbacResult<"listNamespacedRoleBinding">>;
  /** Creates a ClusterRole. */
  readonly createClusterRole: (
    params: k8s.RbacAuthorizationV1ApiCreateClusterRoleRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeEffect<RbacResult<"createClusterRole">>;
  /** Reads a ClusterRole, returning `Option.none` when it is not found. */
  readonly readClusterRole: (
    params: k8s.RbacAuthorizationV1ApiReadClusterRoleRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeOptionEffect<RbacResult<"readClusterRole">>;
  /** Patches a ClusterRole. */
  readonly patchClusterRole: (
    params: k8s.RbacAuthorizationV1ApiPatchClusterRoleRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeEffect<RbacResult<"patchClusterRole">>;
  /** Deletes a ClusterRole, returning `Option.none` when it is already absent. */
  readonly deleteClusterRole: (
    params: k8s.RbacAuthorizationV1ApiDeleteClusterRoleRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeOptionEffect<RbacResult<"deleteClusterRole">>;
  /** Lists ClusterRoles. */
  readonly listClusterRole: (
    params?: k8s.RbacAuthorizationV1ApiListClusterRoleRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeEffect<RbacResult<"listClusterRole">>;
  /** Creates a ClusterRoleBinding. */
  readonly createClusterRoleBinding: (
    params: k8s.RbacAuthorizationV1ApiCreateClusterRoleBindingRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeEffect<RbacResult<"createClusterRoleBinding">>;
  /** Reads a ClusterRoleBinding, returning `Option.none` when it is not found. */
  readonly readClusterRoleBinding: (
    params: k8s.RbacAuthorizationV1ApiReadClusterRoleBindingRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeOptionEffect<RbacResult<"readClusterRoleBinding">>;
  /** Patches a ClusterRoleBinding. */
  readonly patchClusterRoleBinding: (
    params: k8s.RbacAuthorizationV1ApiPatchClusterRoleBindingRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeEffect<RbacResult<"patchClusterRoleBinding">>;
  /** Deletes a ClusterRoleBinding, returning `Option.none` when it is already absent. */
  readonly deleteClusterRoleBinding: (
    params: k8s.RbacAuthorizationV1ApiDeleteClusterRoleBindingRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeOptionEffect<RbacResult<"deleteClusterRoleBinding">>;
  /** Lists ClusterRoleBindings. */
  readonly listClusterRoleBinding: (
    params?: k8s.RbacAuthorizationV1ApiListClusterRoleBindingRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeEffect<RbacResult<"listClusterRoleBinding">>;
}

/** Creates RBAC operation wrappers from an upstream Kubernetes RbacAuthorizationV1 API client. */
export const make = (rbac: k8s.RbacAuthorizationV1Api): Service => ({
  createNamespacedRole: (params, options) =>
    tryKube(() => rbac.createNamespacedRole(params, options)),
  readNamespacedRole: (params, options) =>
    tryKubeOption(() => rbac.readNamespacedRole(params, options)),
  patchNamespacedRole: (params, options) =>
    tryKube(() => rbac.patchNamespacedRole(params, options)),
  deleteNamespacedRole: (params, options) =>
    tryKubeOption(() => rbac.deleteNamespacedRole(params, options)),
  listNamespacedRole: (params, options) => tryKube(() => rbac.listNamespacedRole(params, options)),
  createNamespacedRoleBinding: (params, options) =>
    tryKube(() => rbac.createNamespacedRoleBinding(params, options)),
  readNamespacedRoleBinding: (params, options) =>
    tryKubeOption(() => rbac.readNamespacedRoleBinding(params, options)),
  patchNamespacedRoleBinding: (params, options) =>
    tryKube(() => rbac.patchNamespacedRoleBinding(params, options)),
  deleteNamespacedRoleBinding: (params, options) =>
    tryKubeOption(() => rbac.deleteNamespacedRoleBinding(params, options)),
  listNamespacedRoleBinding: (params, options) =>
    tryKube(() => rbac.listNamespacedRoleBinding(params, options)),
  createClusterRole: (params, options) => tryKube(() => rbac.createClusterRole(params, options)),
  readClusterRole: (params, options) => tryKubeOption(() => rbac.readClusterRole(params, options)),
  patchClusterRole: (params, options) => tryKube(() => rbac.patchClusterRole(params, options)),
  deleteClusterRole: (params, options) =>
    tryKubeOption(() => rbac.deleteClusterRole(params, options)),
  listClusterRole: (params = {}, options) => tryKube(() => rbac.listClusterRole(params, options)),
  createClusterRoleBinding: (params, options) =>
    tryKube(() => rbac.createClusterRoleBinding(params, options)),
  readClusterRoleBinding: (params, options) =>
    tryKubeOption(() => rbac.readClusterRoleBinding(params, options)),
  patchClusterRoleBinding: (params, options) =>
    tryKube(() => rbac.patchClusterRoleBinding(params, options)),
  deleteClusterRoleBinding: (params, options) =>
    tryKubeOption(() => rbac.deleteClusterRoleBinding(params, options)),
  listClusterRoleBinding: (params = {}, options) =>
    tryKube(() => rbac.listClusterRoleBinding(params, options)),
});
