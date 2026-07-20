import * as k8s from "@kubernetes/client-node";

import type { BatchResult, KubeEffect, KubeOptionEffect } from "../types";

import { tryKube, tryKubeOption } from "../helpers";

/** Effect wrappers for selected Kubernetes BatchV1 operations. */
export interface Service {
  /** Creates a Job in a Namespace. */
  readonly createNamespacedJob: (
    params: k8s.BatchV1ApiCreateNamespacedJobRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeEffect<BatchResult<"createNamespacedJob">>;
  /** Reads a Job, returning `Option.none` when it is not found. */
  readonly readNamespacedJob: (
    params: k8s.BatchV1ApiReadNamespacedJobRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeOptionEffect<BatchResult<"readNamespacedJob">>;
  /** Patches a Job. */
  readonly patchNamespacedJob: (
    params: k8s.BatchV1ApiPatchNamespacedJobRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeEffect<BatchResult<"patchNamespacedJob">>;
  /** Deletes a Job, returning `Option.none` when it is already absent. */
  readonly deleteNamespacedJob: (
    params: k8s.BatchV1ApiDeleteNamespacedJobRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeOptionEffect<BatchResult<"deleteNamespacedJob">>;
  /** Lists Jobs in a Namespace. */
  readonly listNamespacedJob: (
    params: k8s.BatchV1ApiListNamespacedJobRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeEffect<BatchResult<"listNamespacedJob">>;
  /** Deletes a collection of Jobs in a Namespace. */
  readonly deleteCollectionNamespacedJob: (
    params: k8s.BatchV1ApiDeleteCollectionNamespacedJobRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeEffect<BatchResult<"deleteCollectionNamespacedJob">>;
  /** Reads Job status, returning `Option.none` when it is not found. */
  readonly readNamespacedJobStatus: (
    params: k8s.BatchV1ApiReadNamespacedJobStatusRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeOptionEffect<BatchResult<"readNamespacedJobStatus">>;
  /** Creates a CronJob in a Namespace. */
  readonly createNamespacedCronJob: (
    params: k8s.BatchV1ApiCreateNamespacedCronJobRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeEffect<BatchResult<"createNamespacedCronJob">>;
  /** Reads a CronJob, returning `Option.none` when it is not found. */
  readonly readNamespacedCronJob: (
    params: k8s.BatchV1ApiReadNamespacedCronJobRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeOptionEffect<BatchResult<"readNamespacedCronJob">>;
  /** Patches a CronJob. */
  readonly patchNamespacedCronJob: (
    params: k8s.BatchV1ApiPatchNamespacedCronJobRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeEffect<BatchResult<"patchNamespacedCronJob">>;
  /** Deletes a CronJob, returning `Option.none` when it is already absent. */
  readonly deleteNamespacedCronJob: (
    params: k8s.BatchV1ApiDeleteNamespacedCronJobRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeOptionEffect<BatchResult<"deleteNamespacedCronJob">>;
  /** Lists CronJobs in a Namespace. */
  readonly listNamespacedCronJob: (
    params: k8s.BatchV1ApiListNamespacedCronJobRequest,
    options?: k8s.ConfigurationOptions,
  ) => KubeEffect<BatchResult<"listNamespacedCronJob">>;
}

/** Creates BatchV1 operation wrappers from an upstream Kubernetes BatchV1 API client. */
export const make = (batch: k8s.BatchV1Api): Service => ({
  createNamespacedJob: (params, options) =>
    tryKube(() => batch.createNamespacedJob(params, options)),
  readNamespacedJob: (params, options) =>
    tryKubeOption(() => batch.readNamespacedJob(params, options)),
  patchNamespacedJob: (params, options) => tryKube(() => batch.patchNamespacedJob(params, options)),
  deleteNamespacedJob: (params, options) =>
    tryKubeOption(() => batch.deleteNamespacedJob(params, options)),
  listNamespacedJob: (params, options) => tryKube(() => batch.listNamespacedJob(params, options)),
  deleteCollectionNamespacedJob: (params, options) =>
    tryKube(() => batch.deleteCollectionNamespacedJob(params, options)),
  readNamespacedJobStatus: (params, options) =>
    tryKubeOption(() => batch.readNamespacedJobStatus(params, options)),
  createNamespacedCronJob: (params, options) =>
    tryKube(() => batch.createNamespacedCronJob(params, options)),
  readNamespacedCronJob: (params, options) =>
    tryKubeOption(() => batch.readNamespacedCronJob(params, options)),
  patchNamespacedCronJob: (params, options) =>
    tryKube(() => batch.patchNamespacedCronJob(params, options)),
  deleteNamespacedCronJob: (params, options) =>
    tryKubeOption(() => batch.deleteNamespacedCronJob(params, options)),
  listNamespacedCronJob: (params, options) =>
    tryKube(() => batch.listNamespacedCronJob(params, options)),
});
