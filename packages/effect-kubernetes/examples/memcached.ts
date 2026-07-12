import { Schema } from "effect";

import { Resource } from "../src/operator";

export const MemcachedGvr = {
  group: "cache.example.com",
  version: "v1alpha1",
  plural: "memcacheds",
  namespaced: true,
} as const;

export const MemcachedSchema = Schema.Struct({
  apiVersion: Schema.optional(Schema.String),
  kind: Schema.optional(Schema.String),
  metadata: Resource.Metadata,
  spec: Schema.Struct({
    size: Schema.Number,
  }),
  status: Schema.optional(
    Schema.Struct({
      readyReplicas: Schema.optional(Schema.Number),
      phase: Schema.optional(Schema.String),
      message: Schema.optional(Schema.String),
    }),
  ),
});

export type Memcached = typeof MemcachedSchema.Type;

export const Memcached = Resource.custom<Memcached>({
  ...MemcachedGvr,
  kind: "Memcached",
  schema: MemcachedSchema,
});
