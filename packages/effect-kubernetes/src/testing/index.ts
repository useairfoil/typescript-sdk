import * as k8s from "@kubernetes/client-node";
import { Cause, Effect, Layer, Option, Queue, Ref, Stream } from "effect";

import type * as ApiExtensions from "../client/api-extensions";
import type * as Apps from "../client/apps";
import type * as Batch from "../client/batch";
import type * as Core from "../client/core";
import type * as CustomObjects from "../client/custom-objects";
import type * as Logs from "../client/logs";
import type * as Networking from "../client/networking";
import type * as Rbac from "../client/rbac";
import type * as Watch from "../client/watch";

import * as Kubernetes from "../client";
import { KubernetesError } from "../errors";

export interface FakeKubernetes {
  readonly layer: Layer.Layer<Kubernetes.Kubernetes>;
  /** Waits until the next fake watch subscription is installed. */
  readonly awaitWatch: Effect.Effect<void>;
  readonly put: <A extends k8s.KubernetesObject>(
    gvr: Kubernetes.GroupVersionResource,
    object: A,
  ) => Effect.Effect<void>;
  readonly emit: <A extends k8s.KubernetesObject>(
    gvr: Kubernetes.GroupVersionResource,
    event: Kubernetes.WatchEvent<A>,
  ) => Effect.Effect<void>;
  readonly failWatch: (error: KubernetesError) => Effect.Effect<void>;
  readonly objects: Effect.Effect<ReadonlyArray<k8s.KubernetesObject>>;
  readonly applied: Effect.Effect<ReadonlyArray<AppliedCall>>;
}

export interface AppliedCall {
  readonly operation: string;
  readonly params: unknown;
  readonly options: unknown;
}

interface State {
  readonly objects: Map<string, k8s.KubernetesObject>;
  readonly watchers: Set<WatchSubscription>;
  readonly applied: ReadonlyArray<AppliedCall>;
}

interface WatchSubscription {
  readonly gvr: Kubernetes.GroupVersionResource;
  readonly namespace: string | undefined;
  readonly queue: Queue.Enqueue<Kubernetes.WatchEvent<k8s.KubernetesObject>, KubernetesError>;
}

/** Creates an in-memory Kubernetes service for tests. */
export const makeFake = (): Effect.Effect<FakeKubernetes> =>
  Effect.gen(function* () {
    const state = yield* Ref.make<State>({ objects: new Map(), watchers: new Set(), applied: [] });
    const watchStarts = yield* Queue.unbounded<void>();

    const record = (operation: string, params: unknown, options: unknown) =>
      Ref.update(state, (current) => ({
        ...current,
        applied: [...current.applied, { operation, params, options }],
      }));

    const put = <A extends k8s.KubernetesObject>(gvr: Kubernetes.GroupVersionResource, object: A) =>
      Ref.update(state, (current) => {
        const objects = new Map(current.objects);
        objects.set(
          objectKey(gvr, object.metadata?.namespace, object.metadata?.name ?? ""),
          object,
        );
        return { ...current, objects };
      });

    const createObject = <A extends k8s.KubernetesObject>(
      gvr: Kubernetes.GroupVersionResource,
      namespace: string | undefined,
      body: A,
    ) =>
      Ref.modify(state, (current) => {
        const created = {
          ...body,
          metadata: {
            ...body.metadata,
            ...(namespace === undefined ? {} : { namespace }),
          },
        };
        const objects = new Map(current.objects);
        objects.set(objectKey(gvr, namespace, created.metadata.name ?? ""), created);
        return [created, { ...current, objects }];
      });

    const applyObject = (
      operation: string,
      params: unknown,
      gvr: Kubernetes.GroupVersionResource,
      namespace: string | undefined,
      name: string,
      body: k8s.KubernetesObject,
      options: unknown,
    ) =>
      record(operation, params, options).pipe(
        Effect.andThen(
          Ref.modify(state, (current) => {
            const key = objectKey(gvr, namespace, name);
            const existing = current.objects.get(key);
            const applied = {
              ...existing,
              ...body,
              metadata: {
                ...existing?.metadata,
                ...body.metadata,
                ...(namespace === undefined ? {} : { namespace }),
                name,
              },
            };
            const objects = new Map(current.objects);
            objects.set(key, applied);
            return [applied, { ...current, objects }];
          }),
        ),
      );

    const getObject = <A extends k8s.KubernetesObject>(
      gvr: Kubernetes.GroupVersionResource,
      namespace: string | undefined,
      name: string,
    ) =>
      Ref.get(state).pipe(
        Effect.map((current) =>
          Option.fromUndefinedOr(
            current.objects.get(objectKey(gvr, namespace, name)) as A | undefined,
          ),
        ),
      );

    const deleteObject = <A>(
      gvr: Kubernetes.GroupVersionResource,
      namespace: string | undefined,
      name: string,
    ) =>
      Ref.modify(state, (current) => {
        const objects = new Map(current.objects);
        const existing = objects.get(objectKey(gvr, namespace, name));
        objects.delete(objectKey(gvr, namespace, name));
        return [Option.fromUndefinedOr(existing as A | undefined), { ...current, objects }];
      });

    const listObjects = <A extends k8s.KubernetesObject>(
      gvr: Kubernetes.GroupVersionResource,
      namespace?: string,
    ) =>
      Ref.get(state).pipe(
        Effect.map((current) => ({
          items: [...current.objects.entries()]
            .filter(([key]) => key.startsWith(gvrId(gvr)))
            .map(([, object]) => object)
            .filter(
              (object) => namespace === undefined || object.metadata?.namespace === namespace,
            ) as A[],
        })),
      );

    const core = makePartialGroup<Core.Service>({
      createNamespacedSecret: (params: k8s.CoreV1ApiCreateNamespacedSecretRequest) =>
        createObject(
          { group: "", version: "v1", plural: "secrets", namespaced: true },
          params.namespace,
          params.body,
        ),
      readNamespacedSecret: (params: k8s.CoreV1ApiReadNamespacedSecretRequest) =>
        getObject<k8s.V1Secret>(
          { group: "", version: "v1", plural: "secrets", namespaced: true },
          params.namespace,
          params.name,
        ),
      patchNamespacedSecret: (params: k8s.CoreV1ApiPatchNamespacedSecretRequest) =>
        applyObject(
          "patchNamespacedSecret",
          params,
          { group: "", version: "v1", plural: "secrets", namespaced: true },
          params.namespace,
          params.name,
          params.body as k8s.V1Secret,
          undefined,
        ),
      deleteNamespacedSecret: (params: k8s.CoreV1ApiDeleteNamespacedSecretRequest) =>
        deleteObject<k8s.V1Status>(
          { group: "", version: "v1", plural: "secrets", namespaced: true },
          params.namespace,
          params.name,
        ),
      listNamespacedPod: (params: k8s.CoreV1ApiListNamespacedPodRequest) =>
        listObjects<k8s.V1Pod>(
          { group: "", version: "v1", plural: "pods", namespaced: true },
          params.namespace,
        ).pipe(Effect.map((list) => ({ items: list.items }))),
    });

    const apps = makePartialGroup<Apps.Service>({
      createNamespacedDeployment: (params: k8s.AppsV1ApiCreateNamespacedDeploymentRequest) =>
        createObject(
          { group: "apps", version: "v1", plural: "deployments", namespaced: true },
          params.namespace,
          params.body,
        ),
      readNamespacedDeployment: (params: k8s.AppsV1ApiReadNamespacedDeploymentRequest) =>
        getObject<k8s.V1Deployment>(
          { group: "apps", version: "v1", plural: "deployments", namespaced: true },
          params.namespace,
          params.name,
        ),
      patchNamespacedDeployment: (
        params: k8s.AppsV1ApiPatchNamespacedDeploymentRequest,
        options?: k8s.ConfigurationOptions,
      ) =>
        applyObject(
          "patchNamespacedDeployment",
          params,
          { group: "apps", version: "v1", plural: "deployments", namespaced: true },
          params.namespace,
          params.name,
          params.body as k8s.V1Deployment,
          options,
        ),
    });

    const customObjects = makePartialGroup<CustomObjects.Service>({
      createClusterCustomObject: <A extends k8s.KubernetesObject>(
        params: k8s.CustomObjectsApiCreateClusterCustomObjectRequest,
      ) => createObject<A>({ ...params, namespaced: false }, undefined, params.body as A),
      createNamespacedCustomObject: <A extends k8s.KubernetesObject>(
        params: k8s.CustomObjectsApiCreateNamespacedCustomObjectRequest,
      ) => createObject<A>({ ...params, namespaced: true }, params.namespace, params.body as A),
      getClusterCustomObject: <A extends k8s.KubernetesObject>(
        params: k8s.CustomObjectsApiGetClusterCustomObjectRequest,
      ) => getObject<A>({ ...params, namespaced: false }, undefined, params.name),
      getNamespacedCustomObject: <A extends k8s.KubernetesObject>(
        params: k8s.CustomObjectsApiGetNamespacedCustomObjectRequest,
      ) => getObject<A>({ ...params, namespaced: true }, params.namespace, params.name),
      listClusterCustomObject: <A extends k8s.KubernetesObject>(
        params: k8s.CustomObjectsApiListClusterCustomObjectRequest,
      ) => listObjects<A>({ ...params, namespaced: false }),
      listCustomObjectForAllNamespaces: <A extends k8s.KubernetesObject>(
        params: k8s.CustomObjectsApiListCustomObjectForAllNamespacesRequest,
      ) => listObjects<A>({ ...params, namespaced: true }),
      listNamespacedCustomObject: <A extends k8s.KubernetesObject>(
        params: k8s.CustomObjectsApiListNamespacedCustomObjectRequest,
      ) => listObjects<A>({ ...params, namespaced: true }, params.namespace),
      patchClusterCustomObject: <A extends k8s.KubernetesObject>(
        params: k8s.CustomObjectsApiPatchClusterCustomObjectRequest,
        options?: k8s.ConfigurationOptions,
      ) =>
        applyObject(
          "patchClusterCustomObject",
          params,
          {
            group: params.group,
            version: params.version,
            plural: params.plural,
            namespaced: false,
          },
          undefined,
          params.name,
          params.body as A,
          options,
        ).pipe(Effect.map((object) => object as A)),
      patchNamespacedCustomObject: <A extends k8s.KubernetesObject>(
        params: k8s.CustomObjectsApiPatchNamespacedCustomObjectRequest,
        options?: k8s.ConfigurationOptions,
      ) =>
        applyObject(
          "patchNamespacedCustomObject",
          params,
          { group: params.group, version: params.version, plural: params.plural, namespaced: true },
          params.namespace,
          params.name,
          params.body as A,
          options,
        ).pipe(Effect.map((object) => object as A)),
      deleteClusterCustomObject: <A = unknown>(
        params: k8s.CustomObjectsApiDeleteClusterCustomObjectRequest,
      ) => deleteObject<A>({ ...params, namespaced: false }, undefined, params.name),
      deleteNamespacedCustomObject: <A = unknown>(
        params: k8s.CustomObjectsApiDeleteNamespacedCustomObjectRequest,
      ) => deleteObject<A>({ ...params, namespaced: true }, params.namespace, params.name),
      patchClusterCustomObjectStatus: <A extends k8s.KubernetesObject>(
        params: k8s.CustomObjectsApiPatchClusterCustomObjectStatusRequest,
        options?: k8s.ConfigurationOptions,
      ) =>
        applyObject(
          "patchClusterCustomObjectStatus",
          params,
          {
            group: params.group,
            version: params.version,
            plural: params.plural,
            namespaced: false,
          },
          undefined,
          params.name,
          params.body as A,
          options,
        ).pipe(Effect.map((object) => object as A)),
      patchNamespacedCustomObjectStatus: <A extends k8s.KubernetesObject>(
        params: k8s.CustomObjectsApiPatchNamespacedCustomObjectStatusRequest,
        options?: k8s.ConfigurationOptions,
      ) =>
        applyObject(
          "patchNamespacedCustomObjectStatus",
          params,
          { group: params.group, version: params.version, plural: params.plural, namespaced: true },
          params.namespace,
          params.name,
          params.body as A,
          options,
        ).pipe(Effect.map((object) => object as A)),
    });

    const watch = makePartialGroup<Watch.Service>({
      watchCustomObjects: <A extends k8s.KubernetesObject>(
        gvr: Kubernetes.GroupVersionResource,
        options?: Kubernetes.WatchOptions | string,
      ) =>
        Stream.unwrap(
          Effect.gen(function* () {
            const queue = yield* Queue.unbounded<
              Kubernetes.WatchEvent<k8s.KubernetesObject>,
              KubernetesError
            >();
            const subscription: WatchSubscription = {
              gvr,
              namespace:
                gvr.namespaced && options !== undefined
                  ? typeof options === "string"
                    ? options
                    : options.namespace
                  : undefined,
              queue,
            };
            yield* Ref.update(state, (current) => ({
              ...current,
              watchers: new Set(current.watchers).add(subscription),
            }));
            yield* Queue.offer(watchStarts, undefined);
            return Stream.fromQueue(queue).pipe(
              Stream.ensuring(
                Ref.update(state, (current) => {
                  const watchers = new Set(current.watchers);
                  watchers.delete(subscription);
                  return { ...current, watchers };
                }),
              ),
            ) as Stream.Stream<Kubernetes.WatchEvent<A>, KubernetesError>;
          }),
        ),
    });

    const service: Kubernetes.Service = {
      getKubeConfig: () => new k8s.KubeConfig(),
      core,
      apps,
      batch: makePartialGroup<Batch.Service>({}),
      rbac: makePartialGroup<Rbac.Service>({}),
      networking: makePartialGroup<Networking.Service>({}),
      apiExtensions: makePartialGroup<ApiExtensions.Service>({}),
      customObjects,
      logs: makePartialGroup<Logs.Service>({}),
      watch,
    };

    const emit = <A extends k8s.KubernetesObject>(
      gvr: Kubernetes.GroupVersionResource,
      event: Kubernetes.WatchEvent<A>,
    ) =>
      Ref.get(state).pipe(
        Effect.flatMap((current) =>
          Effect.all(
            [...current.watchers]
              .filter(
                (watcher) =>
                  gvrId(watcher.gvr) === gvrId(gvr) &&
                  (watcher.namespace === undefined ||
                    watcher.namespace === event.object.metadata?.namespace),
              )
              .map((watcher) => Queue.offer(watcher.queue, event)),
          ).pipe(Effect.asVoid),
        ),
      );

    const failWatch = (error: KubernetesError) =>
      Ref.get(state).pipe(
        Effect.flatMap((current) =>
          Effect.all(
            [...current.watchers].map((watcher) =>
              Queue.failCause(watcher.queue, Cause.fail(error)),
            ),
          ).pipe(Effect.asVoid),
        ),
      );

    return {
      layer: Layer.succeed(Kubernetes.Kubernetes)(service),
      awaitWatch: Queue.take(watchStarts),
      put,
      emit,
      failWatch,
      objects: Ref.get(state).pipe(Effect.map((current) => [...current.objects.values()])),
      applied: Ref.get(state).pipe(Effect.map((current) => current.applied)),
    };
  });

const gvrId = (gvr: Kubernetes.GroupVersionResource): string =>
  `${gvr.group}/${gvr.version}/${gvr.plural}/${gvr.namespaced ? "namespaced" : "cluster"}`;

const objectKey = (
  gvr: Kubernetes.GroupVersionResource,
  namespace: string | undefined,
  name: string,
): string => `${gvrId(gvr)}/${namespace ?? ""}/${name}`;

const makePartialGroup = <A extends object>(service: Partial<A>): A =>
  new Proxy(service, {
    get(target, property, receiver) {
      if (property in target) return Reflect.get(target, property, receiver);
      throw new Error(`Fake Kubernetes method is not implemented: ${String(property)}`);
    },
  }) as A;
