import * as k8s from "@kubernetes/client-node";
import { Cause, Data, Effect, Option, Schema } from "effect";

import type { KubernetesError } from "../errors";

import * as Kubernetes from "../client";

/** Minimum Kubernetes object shape accepted by the generic operator helpers. */
export interface KubernetesObjectShape {
  readonly apiVersion?: string;
  readonly kind?: string;
  readonly spec?: unknown;
  readonly status?: unknown;
  readonly metadata?: {
    readonly name?: string;
    readonly namespace?: string;
    readonly uid?: string;
    readonly generation?: number;
    readonly labels?: Readonly<Record<string, string>>;
    readonly annotations?: Readonly<Record<string, string>>;
  };
}

/** Identifies a custom resource and optionally provides its decoding schema. */
export interface CustomResource<A extends KubernetesObjectShape> {
  readonly group: string;
  readonly version: string;
  readonly kind: string;
  readonly plural: string;
  readonly namespaced: boolean;
  readonly schema?: Schema.Codec<A, unknown, never>;
}

/** Stable reconcile identity for a namespaced or cluster-scoped resource. */
export interface ResourceKey {
  readonly namespace: string | undefined;
  readonly name: string;
}

/** A Kubernetes object did not satisfy its custom resource schema. */
export class ResourceDecodeError extends Data.TaggedError("ResourceDecodeError")<{
  readonly resource: string;
  readonly key: ResourceKey;
  readonly cause: Schema.SchemaError;
}> {}

export { CrdGenerationError, makeCustomResourceDefinition } from "./crd";
export type { CustomResourceDefinitionOptions } from "./crd";

/** Non-negative safe integer used by Kubernetes object generations. */
export const Generation = Schema.Number.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0));

/** Common metadata decoded by custom resource schemas. */
export const Metadata = Schema.Struct({
  name: Schema.optional(Schema.String),
  namespace: Schema.optional(Schema.String),
  uid: Schema.optional(Schema.String),
  generation: Schema.optional(Generation),
  labels: Schema.optional(Schema.Record(Schema.String, Schema.String)),
  annotations: Schema.optional(Schema.Record(Schema.String, Schema.String)),
});

/** Creates a typed custom resource descriptor. */
export const custom = <A extends KubernetesObjectShape>(
  resource: CustomResource<A>,
): CustomResource<A> => Object.freeze({ ...resource });

/** Extracts the reconcile key from a Kubernetes object. */
export const keyOf = (object: KubernetesObjectShape): Option.Option<ResourceKey> => {
  const name = object.metadata?.name;
  if (name === undefined || name === "") return Option.none();
  return Option.some({ namespace: object.metadata?.namespace, name });
};

/** Creates the controller owner reference for a custom resource. */
export const controllerOwnerReference = <A extends KubernetesObjectShape>(
  resource: CustomResource<A>,
  parent: A,
): Effect.Effect<k8s.V1OwnerReference, Cause.IllegalArgumentError> =>
  Effect.gen(function* () {
    const name = parent.metadata?.name;
    const uid = parent.metadata?.uid;
    if (name === undefined || name === "" || uid === undefined || uid === "") {
      return yield* new Cause.IllegalArgumentError(
        "controller owner references require parent metadata.name and metadata.uid",
      );
    }

    return {
      apiVersion: `${resource.group}/${resource.version}`,
      kind: resource.kind,
      name,
      uid,
      controller: true,
      blockOwnerDeletion: true,
    };
  });

/** Finds a dependent object's direct controller owner key. */
export const controllerOwnerKey = <A extends KubernetesObjectShape>(
  resource: CustomResource<A>,
  dependent: k8s.KubernetesObject,
): Option.Option<ResourceKey> => {
  const owner = dependent.metadata?.ownerReferences?.find(
    (reference) =>
      reference.controller === true &&
      reference.apiVersion === `${resource.group}/${resource.version}` &&
      reference.kind === resource.kind,
  );
  if (owner === undefined || owner.name === "") return Option.none();

  const namespace = resource.namespaced ? dependent.metadata?.namespace : undefined;
  if (resource.namespaced && (namespace === undefined || namespace === "")) return Option.none();
  return Option.some({ namespace, name: owner.name });
};

/** Reads and decodes one custom resource. A missing resource returns `Option.none`. */
export const get = <A extends KubernetesObjectShape>(
  resource: CustomResource<A>,
  key: ResourceKey,
): Effect.Effect<
  Option.Option<A>,
  KubernetesError | ResourceDecodeError | Cause.IllegalArgumentError,
  Kubernetes.Kubernetes
> => {
  const read = Effect.gen(function* () {
    if (resource.namespaced) {
      if (key.namespace === undefined) {
        return yield* new Cause.IllegalArgumentError(
          "namespaced custom resource reads require namespace",
        );
      }
      return yield* Kubernetes.getNamespacedCustomObject<KubernetesObjectShape>({
        group: resource.group,
        version: resource.version,
        namespace: key.namespace,
        plural: resource.plural,
        name: key.name,
      });
    }

    return yield* Kubernetes.getClusterCustomObject<KubernetesObjectShape>({
      group: resource.group,
      version: resource.version,
      plural: resource.plural,
      name: key.name,
    });
  });

  return read.pipe(
    Effect.flatMap((object) =>
      Option.isNone(object)
        ? Effect.succeedNone
        : decode(resource, key, object.value).pipe(Effect.asSome),
    ),
  );
};

/** Lists and decodes custom resources, failing when any returned object is invalid. */
export const list = <A extends KubernetesObjectShape>(
  resource: CustomResource<A>,
  namespace?: string,
): Effect.Effect<
  ReadonlyArray<A>,
  KubernetesError | ResourceDecodeError,
  Kubernetes.Kubernetes
> => {
  const read = resource.namespaced
    ? namespace === undefined
      ? Kubernetes.listCustomObjectForAllNamespaces<KubernetesObjectShape>({
          group: resource.group,
          version: resource.version,
          plural: resource.plural,
        })
      : Kubernetes.listNamespacedCustomObject<KubernetesObjectShape>({
          group: resource.group,
          version: resource.version,
          namespace,
          plural: resource.plural,
        })
    : Kubernetes.listClusterCustomObject<KubernetesObjectShape>({
        group: resource.group,
        version: resource.version,
        plural: resource.plural,
      });

  return read.pipe(
    Effect.flatMap((objects) =>
      Effect.forEach(objects.items, (object) =>
        decode(
          resource,
          keyOf(object).pipe(Option.getOrElse(() => ({ namespace: undefined, name: "" }))),
          object,
        ),
      ),
    ),
  );
};

const decode = <A extends KubernetesObjectShape>(
  resource: CustomResource<A>,
  key: ResourceKey,
  object: unknown,
): Effect.Effect<A, ResourceDecodeError> => {
  // A descriptor without a schema explicitly trusts the caller's resource type.
  if (resource.schema === undefined) return Effect.succeed(object as A);

  return Schema.decodeUnknownEffect(resource.schema)(object).pipe(
    Effect.mapError(
      (cause) =>
        new ResourceDecodeError({
          resource: `${resource.group}/${resource.version}/${resource.plural}`,
          key,
          cause,
        }),
    ),
  );
};
