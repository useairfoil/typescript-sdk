import * as k8s from "@kubernetes/client-node";
import { Effect, Option } from "effect";

import type { KubernetesError } from "../errors";

export type ApiMethodResult<F> = F extends (...args: Array<never>) => Promise<infer A> ? A : never;
export type Method<T, K extends keyof T> = Extract<
  T[K],
  (...args: Array<never>) => Promise<unknown>
>;

export type CoreResult<K extends keyof k8s.CoreV1Api> = ApiMethodResult<Method<k8s.CoreV1Api, K>>;
export type AppsResult<K extends keyof k8s.AppsV1Api> = ApiMethodResult<Method<k8s.AppsV1Api, K>>;
export type BatchResult<K extends keyof k8s.BatchV1Api> = ApiMethodResult<
  Method<k8s.BatchV1Api, K>
>;
export type RbacResult<K extends keyof k8s.RbacAuthorizationV1Api> = ApiMethodResult<
  Method<k8s.RbacAuthorizationV1Api, K>
>;
export type NetworkingResult<K extends keyof k8s.NetworkingV1Api> = ApiMethodResult<
  Method<k8s.NetworkingV1Api, K>
>;
export type ApiextensionsResult<K extends keyof k8s.ApiextensionsV1Api> = ApiMethodResult<
  Method<k8s.ApiextensionsV1Api, K>
>;

export type KubeEffect<A> = Effect.Effect<A, KubernetesError>;
export type KubeOptionEffect<A> = Effect.Effect<Option.Option<A>, KubernetesError>;

export interface GroupVersionResource {
  /** API group, or an empty string for the core API group. */
  readonly group: string;
  /** API version, such as `v1` or `v1alpha1`. */
  readonly version: string;
  /** Plural resource name used in Kubernetes API paths. */
  readonly plural: string;
  /** Whether the resource is scoped to a namespace. */
  readonly namespaced: boolean;
}

export interface WatchOptions {
  /** Namespace to watch. Omit for cluster-wide supported watches. */
  readonly namespace?: string;
  /** Kubernetes label selector used for list and watch requests. */
  readonly labelSelector?: string;
}

export interface WatchEvent<A> {
  /** Normalized Kubernetes watch event type. */
  readonly type: "Added" | "Modified" | "Deleted";
  /** Object carried by the watch event. */
  readonly object: A;
}

export interface PodLogStreamRequest {
  /** Namespace containing the Pod. */
  readonly namespace: string;
  /** Pod name. */
  readonly name: string;
  /** Container name. Defaults to Kubernetes' selected container. */
  readonly container?: string;
  /** Continue streaming new log output. */
  readonly follow?: boolean;
  /** Return logs for the previous terminated container instance. */
  readonly previous?: boolean;
  /** Only return logs newer than this many seconds. */
  readonly sinceSeconds?: number;
  /** Only return logs after this timestamp. */
  readonly sinceTime?: string | Date;
  /** Include timestamps in log lines. */
  readonly timestamps?: boolean;
  /** Maximum number of lines to return from the end of the log. */
  readonly tailLines?: number;
  /** Maximum bytes to return. */
  readonly limitBytes?: number;
}
