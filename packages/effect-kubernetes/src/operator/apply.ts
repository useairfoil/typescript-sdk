import * as k8s from "@kubernetes/client-node";
import { Cause, Effect } from "effect";

import type { KubernetesError } from "../errors";
import type { CustomResource, KubernetesObjectShape, ResourceKey } from "./resource";

import * as Kubernetes from "../client";

/** Server-side apply behavior shared by the operator apply helpers. */
export interface ApplyOptions {
  /** Force ownership conflicts. Defaults to `true` for controller-owned fields. */
  readonly force?: boolean;
}

const ssaOptions = k8s.setHeaderOptions("Content-Type", k8s.PatchStrategy.ServerSideApply);

/** Applies a Deployment with server-side apply, supplying its API identity from the arguments. */
export const applyDeployment = (
  namespace: string,
  name: string,
  body: k8s.V1Deployment,
  fieldManager: string,
  options?: ApplyOptions,
): Effect.Effect<k8s.V1Deployment, KubernetesError, Kubernetes.Kubernetes> =>
  Kubernetes.patchNamespacedDeployment(
    {
      namespace,
      name,
      fieldManager,
      force: options?.force ?? true,
      body: {
        ...body,
        apiVersion: "apps/v1",
        kind: "Deployment",
        metadata: {
          ...body.metadata,
          namespace,
          name,
        },
      },
    },
    ssaOptions,
  ).pipe(
    Effect.tap(() => Effect.logDebug("Deployment applied with server-side apply")),
    Effect.annotateLogs({ fieldManager, namespace, name }),
  );

/** Applies a custom resource with server-side apply, supplying its API identity from the descriptor. */
export const applyCustomObject = <A extends KubernetesObjectShape>(
  resource: CustomResource<A>,
  key: ResourceKey,
  body: A,
  fieldManager: string,
  options?: ApplyOptions,
): Effect.Effect<A, KubernetesError | Cause.IllegalArgumentError, Kubernetes.Kubernetes> => {
  const applyBody = withResourceIdentity(resource, key, body);
  const logApplied = Effect.logDebug("Custom resource applied with server-side apply").pipe(
    Effect.annotateLogs({
      fieldManager,
      resource: `${resource.group}/${resource.version}/${resource.plural}`,
      namespace: key.namespace ?? "",
      name: key.name,
    }),
  );

  return resource.namespaced
    ? key.namespace === undefined
      ? Effect.fail(
          new Cause.IllegalArgumentError("namespaced custom resource applies require namespace"),
        )
      : Kubernetes.patchNamespacedCustomObject<A>(
          {
            group: resource.group,
            version: resource.version,
            namespace: key.namespace,
            plural: resource.plural,
            name: key.name,
            fieldManager,
            force: options?.force ?? true,
            body: applyBody,
          },
          ssaOptions,
        ).pipe(Effect.tap(() => logApplied))
    : Kubernetes.patchClusterCustomObject<A>(
        {
          group: resource.group,
          version: resource.version,
          plural: resource.plural,
          name: key.name,
          fieldManager,
          force: options?.force ?? true,
          body: applyBody,
        },
        ssaOptions,
      ).pipe(Effect.tap(() => logApplied));
};

/** Applies only a custom resource's `/status` subresource with server-side apply. */
export const applyStatus = <A extends KubernetesObjectShape>(
  resource: CustomResource<A>,
  key: ResourceKey,
  status: unknown,
  fieldManager: string,
  options?: ApplyOptions,
): Effect.Effect<A, KubernetesError | Cause.IllegalArgumentError, Kubernetes.Kubernetes> => {
  const body = withResourceIdentity(resource, key, { status });
  const logApplied = Effect.logDebug("Status applied with server-side apply").pipe(
    Effect.annotateLogs({
      fieldManager,
      resource: `${resource.group}/${resource.version}/${resource.plural}`,
      namespace: key.namespace ?? "",
      name: key.name,
    }),
  );

  return resource.namespaced
    ? key.namespace === undefined
      ? Effect.fail(
          new Cause.IllegalArgumentError(
            "namespaced custom resource status applies require namespace",
          ),
        )
      : Kubernetes.patchNamespacedCustomObjectStatus<A>(
          {
            group: resource.group,
            version: resource.version,
            namespace: key.namespace,
            plural: resource.plural,
            name: key.name,
            fieldManager,
            force: options?.force ?? true,
            body,
          },
          ssaOptions,
        ).pipe(Effect.tap(() => logApplied))
    : Kubernetes.patchClusterCustomObjectStatus<A>(
        {
          group: resource.group,
          version: resource.version,
          plural: resource.plural,
          name: key.name,
          fieldManager,
          force: options?.force ?? true,
          body,
        },
        ssaOptions,
      ).pipe(Effect.tap(() => logApplied));
};

const withResourceIdentity = <A extends KubernetesObjectShape, B extends KubernetesObjectShape>(
  resource: CustomResource<A>,
  key: ResourceKey,
  body: B,
) => ({
  ...body,
  apiVersion: `${resource.group}/${resource.version}`,
  kind: resource.kind,
  metadata: {
    ...body.metadata,
    name: key.name,
    ...(key.namespace === undefined ? {} : { namespace: key.namespace }),
  },
});
