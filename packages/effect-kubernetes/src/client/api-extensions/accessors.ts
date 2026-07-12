import * as k8s from "@kubernetes/client-node";

import { access } from "../accessor";

/** Creates a CustomResourceDefinition using the `Kubernetes` service from context. */
export const createCustomResourceDefinition = (
  params: k8s.ApiextensionsV1ApiCreateCustomResourceDefinitionRequest,
  options?: k8s.ConfigurationOptions,
) =>
  access((kubernetes) => kubernetes.apiExtensions.createCustomResourceDefinition(params, options));
/** Reads a CustomResourceDefinition from context, returning `Option.none` when it is not found. */
export const readCustomResourceDefinition = (
  params: k8s.ApiextensionsV1ApiReadCustomResourceDefinitionRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.apiExtensions.readCustomResourceDefinition(params, options));
/** Patches a CustomResourceDefinition using the `Kubernetes` service from context. */
export const patchCustomResourceDefinition = (
  params: k8s.ApiextensionsV1ApiPatchCustomResourceDefinitionRequest,
  options?: k8s.ConfigurationOptions,
) =>
  access((kubernetes) => kubernetes.apiExtensions.patchCustomResourceDefinition(params, options));
/** Deletes a CustomResourceDefinition from context, returning `Option.none` when it is already absent. */
export const deleteCustomResourceDefinition = (
  params: k8s.ApiextensionsV1ApiDeleteCustomResourceDefinitionRequest,
  options?: k8s.ConfigurationOptions,
) =>
  access((kubernetes) => kubernetes.apiExtensions.deleteCustomResourceDefinition(params, options));
/** Lists CustomResourceDefinitions using the `Kubernetes` service from context. */
export const listCustomResourceDefinition = (
  params?: k8s.ApiextensionsV1ApiListCustomResourceDefinitionRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.apiExtensions.listCustomResourceDefinition(params, options));
