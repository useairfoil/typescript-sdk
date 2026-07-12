import * as k8s from "@kubernetes/client-node";

import type { ApiextensionsResult, KubeEffect, KubeOptionEffect } from "../types";

import { tryKube, tryKubeOption } from "../helpers";

/** Effect wrappers for selected Kubernetes ApiextensionsV1 operations. */
export interface Service {
  /** Creates a CustomResourceDefinition. */
  readonly createCustomResourceDefinition: (
    params: k8s.ApiextensionsV1ApiCreateCustomResourceDefinitionRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeEffect<ApiextensionsResult<"createCustomResourceDefinition">>;
  /** Reads a CustomResourceDefinition, returning `Option.none` when it is not found. */
  readonly readCustomResourceDefinition: (
    params: k8s.ApiextensionsV1ApiReadCustomResourceDefinitionRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeOptionEffect<ApiextensionsResult<"readCustomResourceDefinition">>;
  /** Patches a CustomResourceDefinition. */
  readonly patchCustomResourceDefinition: (
    params: k8s.ApiextensionsV1ApiPatchCustomResourceDefinitionRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeEffect<ApiextensionsResult<"patchCustomResourceDefinition">>;
  /** Deletes a CustomResourceDefinition, returning `Option.none` when it is already absent. */
  readonly deleteCustomResourceDefinition: (
    params: k8s.ApiextensionsV1ApiDeleteCustomResourceDefinitionRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeOptionEffect<ApiextensionsResult<"deleteCustomResourceDefinition">>;
  /** Lists CustomResourceDefinitions. */
  readonly listCustomResourceDefinition: (
    params?: k8s.ApiextensionsV1ApiListCustomResourceDefinitionRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeEffect<ApiextensionsResult<"listCustomResourceDefinition">>;
}

/** Creates ApiextensionsV1 operation wrappers from an upstream Kubernetes ApiextensionsV1 API client. */
export const make = (apiextensions: k8s.ApiextensionsV1Api): Service => ({
  createCustomResourceDefinition: (params, options) =>
    tryKube(() => apiextensions.createCustomResourceDefinition(params, options)),
  readCustomResourceDefinition: (params, options) =>
    tryKubeOption(() => apiextensions.readCustomResourceDefinition(params, options)),
  patchCustomResourceDefinition: (params, options) =>
    tryKube(() => apiextensions.patchCustomResourceDefinition(params, options)),
  deleteCustomResourceDefinition: (params, options) =>
    tryKubeOption(() => apiextensions.deleteCustomResourceDefinition(params, options)),
  listCustomResourceDefinition: (params = {}, options) =>
    tryKube(() => apiextensions.listCustomResourceDefinition(params, options)),
});
