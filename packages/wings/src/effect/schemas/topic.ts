import { Schema as ArrowSchema } from "apache-arrow";
import { Schema as EffectSchema } from "effect";

import {
  deserializeSchemaBytesToFieldConfigs,
  deserializeSchemaBytesToSchema,
  type FieldConfig,
  serializeFieldsToSchemaBytes,
} from "../../lib/arrow";
import type * as proto from "../../proto/cluster_metadata";

// Schema for FieldConfig - validates that it's a valid field configuration
const FieldConfigSchema = EffectSchema.declare(
  (input: unknown): input is FieldConfig => {
    if (typeof input !== "object" || input === null) return false;
    const obj = input as Record<string, unknown>;
    return (
      typeof obj.name === "string" &&
      typeof obj.nullable === "boolean" &&
      typeof obj.dataType === "string"
    );
  },
  {
    identifier: "FieldConfig",
    description: "A valid Arrow field configuration",
  },
);

const ArrowSchemaSchema = EffectSchema.instanceOf(ArrowSchema, {
  identifier: "ArrowSchema",
  description: "An Apache Arrow Schema instance",
});

export const CompactionConfiguration = EffectSchema.Struct({
  /** How often to compact the topic, in seconds. */
  freshnessSeconds: EffectSchema.BigIntFromSelf,
  /** How long to keep the topic data, in seconds. */
  ttlSeconds: EffectSchema.optional(EffectSchema.BigIntFromSelf),
});

export type CompactionConfiguration = typeof CompactionConfiguration.Type;

export const CreateTopicRequest = EffectSchema.Struct({
  /**
   * The namespace that owns the topic.
   *
   * Format: tenants/{tenant}/namespaces/{namespace}
   */
  parent: EffectSchema.String,
  /** The topic id. */
  topicId: EffectSchema.String,
  /** The fields in the topic messages. */
  fields: EffectSchema.Array(FieldConfigSchema),
  /** The topic description. */
  description: EffectSchema.optional(EffectSchema.String),
  /** The index of the field that is used to partition the topic. */
  partitionKey: EffectSchema.optional(EffectSchema.Number),
  /** The topic compaction configuration. */
  compaction: CompactionConfiguration,
});

export type CreateTopicRequest = typeof CreateTopicRequest.Type;

export const GetTopicRequest = EffectSchema.Struct({
  /**
   * The topic name.
   *
   * Format: tenants/{tenant}/namespaces/{namespace}/topics/{topic}
   */
  name: EffectSchema.String,
});

export type GetTopicRequest = typeof GetTopicRequest.Type;

export const ListTopicsRequest = EffectSchema.Struct({
  /**
   * The parent namespace.
   *
   * Format: tenants/{tenant}/namespaces/{namespace}
   */
  parent: EffectSchema.String,
  /** The number of topics to return. */
  pageSize: EffectSchema.optional(EffectSchema.Number),
  /** The continuation token. */
  pageToken: EffectSchema.optional(EffectSchema.String),
});

export type ListTopicsRequest = typeof ListTopicsRequest.Type;

export const Topic = EffectSchema.Struct({
  /**
   * The topic name.
   *
   * Format: tenants/{tenant}/namespaces/{namespace}/topics/{topic}
   */
  name: EffectSchema.String,
  /** The fields in the topic messages. */
  fields: EffectSchema.Array(FieldConfigSchema),
  /** The schema of the topic messages. */
  schema: ArrowSchemaSchema,
  /** The topic description. */
  description: EffectSchema.optional(EffectSchema.String),
  /** The index of the field that is used to partition the topic. */
  partitionKey: EffectSchema.optional(EffectSchema.Number),
  /** The topic compaction configuration. */
  compaction: CompactionConfiguration,
});

export type Topic = typeof Topic.Type;

export const ListTopicsResponse = EffectSchema.Struct({
  /** The topics. */
  topics: EffectSchema.Array(Topic),
  /** The continuation token. */
  nextPageToken: EffectSchema.String,
});

export type ListTopicsResponse = typeof ListTopicsResponse.Type;

export const DeleteTopicRequest = EffectSchema.Struct({
  /**
   * The topic name.
   *
   * Format: tenants/{tenant}/namespaces/{namespace}/topics/{topic}
   */
  name: EffectSchema.String,
  /** If set to true, also delete data associated with the topic. */
  force: EffectSchema.Boolean,
});

export type DeleteTopicRequest = typeof DeleteTopicRequest.Type;

export const Codec = {
  CompactionConfiguration: {
    toProto: (
      value: CompactionConfiguration,
    ): proto.CompactionConfiguration => ({
      $type: "wings.v1.cluster_metadata.CompactionConfiguration",
      freshnessSeconds: value.freshnessSeconds,
      ttlSeconds: value.ttlSeconds,
    }),
    fromProto: (
      value: proto.CompactionConfiguration,
    ): CompactionConfiguration => ({
      freshnessSeconds: value.freshnessSeconds,
      ttlSeconds: value.ttlSeconds,
    }),
  },

  CreateTopicRequest: {
    toProto: (value: CreateTopicRequest): proto.CreateTopicRequest => {
      const schemaBytes = serializeFieldsToSchemaBytes(value.fields);

      return {
        $type: "wings.v1.cluster_metadata.CreateTopicRequest",
        parent: value.parent,
        topicId: value.topicId,
        topic: {
          $type: "wings.v1.cluster_metadata.Topic",
          name: `${value.parent}/topics/${value.topicId}`,
          fields: schemaBytes,
          description: value.description,
          partitionKey: value.partitionKey,
          compaction: Codec.CompactionConfiguration.toProto(value.compaction),
        },
      };
    },
    fromProto: (value: proto.CreateTopicRequest): CreateTopicRequest => {
      if (value.topic === undefined) {
        throw new Error("Topic metadata is undefined");
      }

      const fields = deserializeSchemaBytesToFieldConfigs(value.topic.fields);
      const compaction = Codec.CompactionConfiguration.fromProto(
        value.topic.compaction!,
      );

      return {
        parent: value.parent,
        topicId: value.topicId,
        fields,
        description: value.topic.description,
        partitionKey: value.topic.partitionKey,
        compaction,
      };
    },
  },

  Topic: {
    toProto: (value: Topic): proto.Topic => ({
      $type: "wings.v1.cluster_metadata.Topic",
      name: value.name,
      fields: serializeFieldsToSchemaBytes(value.fields),
      description: value.description,
      partitionKey: value.partitionKey,
      compaction: Codec.CompactionConfiguration.toProto(value.compaction),
    }),
    fromProto: (value: proto.Topic): Topic => {
      const fields = deserializeSchemaBytesToFieldConfigs(value.fields);
      const schema = deserializeSchemaBytesToSchema(value.fields);
      const compaction = Codec.CompactionConfiguration.fromProto(
        value.compaction!,
      );

      return {
        name: value.name,
        fields,
        schema,
        description: value.description,
        partitionKey: value.partitionKey,
        compaction,
      };
    },
  },

  GetTopicRequest: {
    toProto: (value: GetTopicRequest): proto.GetTopicRequest => ({
      $type: "wings.v1.cluster_metadata.GetTopicRequest",
      name: value.name,
    }),
    fromProto: (value: proto.GetTopicRequest): GetTopicRequest => ({
      name: value.name,
    }),
  },

  ListTopicsRequest: {
    toProto: (value: ListTopicsRequest): proto.ListTopicsRequest => ({
      $type: "wings.v1.cluster_metadata.ListTopicsRequest",
      parent: value.parent,
      pageSize: value.pageSize,
      pageToken: value.pageToken,
    }),
    fromProto: (value: proto.ListTopicsRequest): ListTopicsRequest => ({
      parent: value.parent,
      pageSize: value.pageSize,
      pageToken: value.pageToken,
    }),
  },

  ListTopicsResponse: {
    toProto: (value: ListTopicsResponse): proto.ListTopicsResponse => ({
      $type: "wings.v1.cluster_metadata.ListTopicsResponse",
      topics: value.topics.map(Codec.Topic.toProto),
      nextPageToken: value.nextPageToken,
    }),
    fromProto: (value: proto.ListTopicsResponse): ListTopicsResponse => ({
      topics: value.topics.map(Codec.Topic.fromProto),
      nextPageToken: value.nextPageToken,
    }),
  },

  DeleteTopicRequest: {
    toProto: (value: DeleteTopicRequest): proto.DeleteTopicRequest => ({
      $type: "wings.v1.cluster_metadata.DeleteTopicRequest",
      name: value.name,
      force: value.force,
    }),
    fromProto: (value: proto.DeleteTopicRequest): DeleteTopicRequest => ({
      name: value.name,
      force: value.force,
    }),
  },
} as const;
