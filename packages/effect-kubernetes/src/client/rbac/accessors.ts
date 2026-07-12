import * as k8s from "@kubernetes/client-node";

import { access } from "../accessor";

/** Creates a Role in a Namespace using the `Kubernetes` service from context. */
export const createNamespacedRole = (
  params: k8s.RbacAuthorizationV1ApiCreateNamespacedRoleRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.rbac.createNamespacedRole(params, options));
/** Reads a Role from context, returning `Option.none` when it is not found. */
export const readNamespacedRole = (
  params: k8s.RbacAuthorizationV1ApiReadNamespacedRoleRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.rbac.readNamespacedRole(params, options));
/** Patches a Role using the `Kubernetes` service from context. */
export const patchNamespacedRole = (
  params: k8s.RbacAuthorizationV1ApiPatchNamespacedRoleRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.rbac.patchNamespacedRole(params, options));
/** Deletes a Role from context, returning `Option.none` when it is already absent. */
export const deleteNamespacedRole = (
  params: k8s.RbacAuthorizationV1ApiDeleteNamespacedRoleRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.rbac.deleteNamespacedRole(params, options));
/** Lists Roles in a Namespace using the `Kubernetes` service from context. */
export const listNamespacedRole = (
  params: k8s.RbacAuthorizationV1ApiListNamespacedRoleRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.rbac.listNamespacedRole(params, options));
/** Creates a RoleBinding in a Namespace using the `Kubernetes` service from context. */
export const createNamespacedRoleBinding = (
  params: k8s.RbacAuthorizationV1ApiCreateNamespacedRoleBindingRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.rbac.createNamespacedRoleBinding(params, options));
/** Reads a RoleBinding from context, returning `Option.none` when it is not found. */
export const readNamespacedRoleBinding = (
  params: k8s.RbacAuthorizationV1ApiReadNamespacedRoleBindingRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.rbac.readNamespacedRoleBinding(params, options));
/** Patches a RoleBinding using the `Kubernetes` service from context. */
export const patchNamespacedRoleBinding = (
  params: k8s.RbacAuthorizationV1ApiPatchNamespacedRoleBindingRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.rbac.patchNamespacedRoleBinding(params, options));
/** Deletes a RoleBinding from context, returning `Option.none` when it is already absent. */
export const deleteNamespacedRoleBinding = (
  params: k8s.RbacAuthorizationV1ApiDeleteNamespacedRoleBindingRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.rbac.deleteNamespacedRoleBinding(params, options));
/** Lists RoleBindings in a Namespace using the `Kubernetes` service from context. */
export const listNamespacedRoleBinding = (
  params: k8s.RbacAuthorizationV1ApiListNamespacedRoleBindingRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.rbac.listNamespacedRoleBinding(params, options));
/** Creates a ClusterRole using the `Kubernetes` service from context. */
export const createClusterRole = (
  params: k8s.RbacAuthorizationV1ApiCreateClusterRoleRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.rbac.createClusterRole(params, options));
/** Reads a ClusterRole from context, returning `Option.none` when it is not found. */
export const readClusterRole = (
  params: k8s.RbacAuthorizationV1ApiReadClusterRoleRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.rbac.readClusterRole(params, options));
/** Patches a ClusterRole using the `Kubernetes` service from context. */
export const patchClusterRole = (
  params: k8s.RbacAuthorizationV1ApiPatchClusterRoleRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.rbac.patchClusterRole(params, options));
/** Deletes a ClusterRole from context, returning `Option.none` when it is already absent. */
export const deleteClusterRole = (
  params: k8s.RbacAuthorizationV1ApiDeleteClusterRoleRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.rbac.deleteClusterRole(params, options));
/** Lists ClusterRoles using the `Kubernetes` service from context. */
export const listClusterRole = (
  params?: k8s.RbacAuthorizationV1ApiListClusterRoleRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.rbac.listClusterRole(params, options));
/** Creates a ClusterRoleBinding using the `Kubernetes` service from context. */
export const createClusterRoleBinding = (
  params: k8s.RbacAuthorizationV1ApiCreateClusterRoleBindingRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.rbac.createClusterRoleBinding(params, options));
/** Reads a ClusterRoleBinding from context, returning `Option.none` when it is not found. */
export const readClusterRoleBinding = (
  params: k8s.RbacAuthorizationV1ApiReadClusterRoleBindingRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.rbac.readClusterRoleBinding(params, options));
/** Patches a ClusterRoleBinding using the `Kubernetes` service from context. */
export const patchClusterRoleBinding = (
  params: k8s.RbacAuthorizationV1ApiPatchClusterRoleBindingRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.rbac.patchClusterRoleBinding(params, options));
/** Deletes a ClusterRoleBinding from context, returning `Option.none` when it is already absent. */
export const deleteClusterRoleBinding = (
  params: k8s.RbacAuthorizationV1ApiDeleteClusterRoleBindingRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.rbac.deleteClusterRoleBinding(params, options));
/** Lists ClusterRoleBindings using the `Kubernetes` service from context. */
export const listClusterRoleBinding = (
  params?: k8s.RbacAuthorizationV1ApiListClusterRoleBindingRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.rbac.listClusterRoleBinding(params, options));
