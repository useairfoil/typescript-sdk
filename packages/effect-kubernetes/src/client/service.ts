import { KubeConfig } from "@kubernetes/client-node";

import type * as ApiExtensions from "./api-extensions";
import type * as Apps from "./apps";
import type * as Batch from "./batch";
import type * as Core from "./core";
import type * as CustomObjects from "./custom-objects";
import type * as Logs from "./logs";
import type * as Networking from "./networking";
import type * as Rbac from "./rbac";
import type * as Watch from "./watch";

export type { GroupVersionResource, PodLogStreamRequest, WatchEvent, WatchOptions } from "./types";

/** Complete Effect-wrapped Kubernetes client service. */
export interface Service {
  /** Returns the underlying Kubernetes config. */
  readonly getKubeConfig: () => KubeConfig;
  /** CoreV1 operations such as Pods, Secrets, ConfigMaps, Services, and Namespaces. */
  readonly core: Core.Service;
  /** AppsV1 operations such as Deployments and ReplicaSets. */
  readonly apps: Apps.Service;
  /** BatchV1 operations such as Jobs and CronJobs. */
  readonly batch: Batch.Service;
  /** RbacAuthorizationV1 operations such as Roles and RoleBindings. */
  readonly rbac: Rbac.Service;
  /** NetworkingV1 operations such as Ingresses. */
  readonly networking: Networking.Service;
  /** ApiextensionsV1 operations such as CustomResourceDefinitions. */
  readonly apiExtensions: ApiExtensions.Service;
  /** CustomObjectsApi operations for CRDs. */
  readonly customObjects: CustomObjects.Service;
  /** Pod log streaming operations. */
  readonly logs: Logs.Service;
  /** Watch operations backed by Kubernetes informers. */
  readonly watch: Watch.Service;
}
