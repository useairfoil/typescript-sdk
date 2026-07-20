import { Schema } from "effect";

import { Condition, Resource } from "../src/operator";

// Deployment replicas are non-negative 32-bit integers.
const ReplicaCount = Schema.Number.check(Schema.isInt32(), Schema.isGreaterThanOrEqualTo(0));

/** API identity shared by the example schema, controller, and integration test. */
export const MemcachedGvr = {
  group: "cache.example.com",
  version: "v1alpha1",
  plural: "memcacheds",
  namespaced: true,
} as const;

/** Source of truth for runtime decoding and generated CRD validation. */
export const MemcachedSchema = Schema.Struct({
  apiVersion: Schema.optionalKey(Schema.String),
  kind: Schema.optionalKey(Schema.String),
  metadata: Resource.Metadata,
  spec: Schema.Struct({
    size: ReplicaCount,
  }),
  status: Schema.optionalKey(
    Schema.Struct({
      observedGeneration: Schema.optionalKey(Resource.Generation),
      readyReplicas: Schema.optionalKey(ReplicaCount),
      phase: Schema.optionalKey(Schema.String),
      message: Schema.optionalKey(Schema.String),
      conditions: Schema.optionalKey(Condition.List),
    }),
  ),
});

export type Memcached = typeof MemcachedSchema.Type;

/** Typed custom resource descriptor consumed by the operator helpers. */
export const Memcached = Resource.custom<Memcached>({
  ...MemcachedGvr,
  kind: "Memcached",
  schema: MemcachedSchema,
});

/** CRD generated from `MemcachedSchema` and written by the example CLI. */
export const MemcachedCrd = Resource.makeCustomResourceDefinition(Memcached, {
  singular: "memcached",
  shortNames: ["mc"],
  status: true,
  additionalPrinterColumns: [
    { name: "Size", type: "integer", jsonPath: ".spec.size" },
    { name: "Ready", type: "integer", jsonPath: ".status.readyReplicas" },
    { name: "Phase", type: "string", jsonPath: ".status.phase" },
  ],
});
