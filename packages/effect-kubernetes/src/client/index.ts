import * as k8s from "@kubernetes/client-node";
import { KubeConfig, makeInformer } from "@kubernetes/client-node";
import { Layer } from "effect";

import type { Service } from "./service";

import * as ApiExtensions from "./api-extensions";
import * as Apps from "./apps";
import * as Batch from "./batch";
import { Kubernetes } from "./context";
import * as Core from "./core";
import * as CustomObjects from "./custom-objects";
import * as Logs from "./logs";
import * as Networking from "./networking";
import * as Rbac from "./rbac";
import * as Watch from "./watch";

export type {
  GroupVersionResource,
  PodLogStreamRequest,
  Service,
  WatchEvent,
  WatchOptions,
} from "./service";
export { Kubernetes } from "./context";

export interface MakeOptions {
  /** Overrides the upstream informer factory. Primarily useful for tests. */
  readonly makeInformer?: typeof makeInformer;
}

/** Creates a `Kubernetes` service from a concrete Kubernetes config. */
export const make = (kubeConfig: KubeConfig, options?: MakeOptions): Service => {
  const core = kubeConfig.makeApiClient(k8s.CoreV1Api);
  const apps = kubeConfig.makeApiClient(k8s.AppsV1Api);
  const batch = kubeConfig.makeApiClient(k8s.BatchV1Api);
  const rbac = kubeConfig.makeApiClient(k8s.RbacAuthorizationV1Api);
  const networking = kubeConfig.makeApiClient(k8s.NetworkingV1Api);
  const apiextensions = kubeConfig.makeApiClient(k8s.ApiextensionsV1Api);
  const customObjects = kubeConfig.makeApiClient(k8s.CustomObjectsApi);
  const logs = new k8s.Log(kubeConfig);

  return Kubernetes.of({
    getKubeConfig: () => kubeConfig,
    core: Core.make(core),
    apps: Apps.make(apps),
    batch: Batch.make(batch),
    rbac: Rbac.make(rbac),
    networking: Networking.make(networking),
    apiExtensions: ApiExtensions.make(apiextensions),
    customObjects: CustomObjects.make(customObjects),
    logs: Logs.make(logs),
    watch: Watch.make(kubeConfig, core, apps, customObjects, options),
  });
};

export * from "./accessors";

/** Creates a `Kubernetes` layer from a concrete Kubernetes config. */
export const layer = (kubeConfig: KubeConfig, options?: MakeOptions): Layer.Layer<Kubernetes> =>
  Layer.succeed(Kubernetes)(make(kubeConfig, options));
