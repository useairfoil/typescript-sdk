import * as k8s from "@kubernetes/client-node";

import { access } from "../accessor";

/** Creates a Job in a Namespace using the `Kubernetes` service from context. */
export const createNamespacedJob = (
  params: k8s.BatchV1ApiCreateNamespacedJobRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.batch.createNamespacedJob(params, options));
/** Reads a Job from context, returning `Option.none` when it is not found. */
export const readNamespacedJob = (
  params: k8s.BatchV1ApiReadNamespacedJobRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.batch.readNamespacedJob(params, options));
/** Patches a Job using the `Kubernetes` service from context. */
export const patchNamespacedJob = (
  params: k8s.BatchV1ApiPatchNamespacedJobRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.batch.patchNamespacedJob(params, options));
/** Deletes a Job from context, returning `Option.none` when it is already absent. */
export const deleteNamespacedJob = (
  params: k8s.BatchV1ApiDeleteNamespacedJobRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.batch.deleteNamespacedJob(params, options));
/** Lists Jobs in a Namespace using the `Kubernetes` service from context. */
export const listNamespacedJob = (
  params: k8s.BatchV1ApiListNamespacedJobRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.batch.listNamespacedJob(params, options));
/** Deletes a collection of Jobs in a Namespace using the `Kubernetes` service from context. */
export const deleteCollectionNamespacedJob = (
  params: k8s.BatchV1ApiDeleteCollectionNamespacedJobRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.batch.deleteCollectionNamespacedJob(params, options));
/** Reads Job status from context, returning `Option.none` when it is not found. */
export const readNamespacedJobStatus = (
  params: k8s.BatchV1ApiReadNamespacedJobStatusRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.batch.readNamespacedJobStatus(params, options));

/** Creates a CronJob in a Namespace using the `Kubernetes` service from context. */
export const createNamespacedCronJob = (
  params: k8s.BatchV1ApiCreateNamespacedCronJobRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.batch.createNamespacedCronJob(params, options));
/** Reads a CronJob from context, returning `Option.none` when it is not found. */
export const readNamespacedCronJob = (
  params: k8s.BatchV1ApiReadNamespacedCronJobRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.batch.readNamespacedCronJob(params, options));
/** Patches a CronJob using the `Kubernetes` service from context. */
export const patchNamespacedCronJob = (
  params: k8s.BatchV1ApiPatchNamespacedCronJobRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.batch.patchNamespacedCronJob(params, options));
/** Deletes a CronJob from context, returning `Option.none` when it is already absent. */
export const deleteNamespacedCronJob = (
  params: k8s.BatchV1ApiDeleteNamespacedCronJobRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.batch.deleteNamespacedCronJob(params, options));
/** Lists CronJobs in a Namespace using the `Kubernetes` service from context. */
export const listNamespacedCronJob = (
  params: k8s.BatchV1ApiListNamespacedCronJobRequest,
  options?: k8s.ConfigurationOptions,
) => access((kubernetes) => kubernetes.batch.listNamespacedCronJob(params, options));
