import { Schema as ApacheArrowSchema } from "apache-arrow";
import { Schema } from "effect";

import {
  arrowFieldToFieldConfig,
  arrowSchemaFromProto,
  arrowSchemaToProto,
  createArrowField,
  type FieldConfig,
} from "../lib/arrow";
import type * as proto from "../proto/wings/v1/cluster_metadata";
import { TopicView } from "../proto/wings/v1/cluster_metadata";
import { ArrowSchema, Codec as ArrowTypeCodec } from "./arrow-type";

export { TopicView };

//  ███████████  ███████████      ███████    ███████████    ███████
// ░░███░░░░░███░░███░░░░░███   ███░░░░░███ ░█░░░███░░░█  ███░░░░░███
//  ░███    ░███ ░███    ░███  ███     ░░███░   ░███  ░  ███     ░░███
//  ░██████████  ░██████████  ░███      ░███    ░███    ░███      ░███
//  ░███░░░░░░   ░███░░░░░███ ░███      ░███    ░███    ░███      ░███
//  ░███         ░███    ░███ ░░███     ███     ░███    ░░███     ███
//  █████        █████   █████ ░░░███████░      █████    ░░░███████░
// ░░░░░        ░░░░░   ░░░░░    ░░░░░░░       ░░░░░       ░░░░░░░

const isFieldConfig = (input: unknown): input is FieldConfig => {
  if (typeof input !== "object" || input === null) return false;
  const obj = input as Record<string, unknown>;
  return (
    typeof obj.name === "string" &&
    typeof obj.nullable === "boolean" &&
    typeof obj.dataType === "string" &&
    typeof obj.id === "bigint"
  );
};

const GetTopicRequestProto = Schema.Struct({
  $type: Schema.Literal("wings.v1.cluster_metadata.GetTopicRequest"),
  name: Schema.String,
  view: Schema.optional(Schema.Enums(TopicView)),
});

const ListTopicsRequestProto = Schema.Struct({
  $type: Schema.Literal("wings.v1.cluster_metadata.ListTopicsRequest"),
  parent: Schema.String,
  pageSize: Schema.optional(Schema.Number),
  pageToken: Schema.optional(Schema.String),
});

const DeleteTopicRequestProto = Schema.Struct({
  $type: Schema.Literal("wings.v1.cluster_metadata.DeleteTopicRequest"),
  name: Schema.String,
  force: Schema.Boolean,
});

//    █████████   ███████████  ███████████
//   ███░░░░░███ ░░███░░░░░███░░███░░░░░███
//  ░███    ░███  ░███    ░███ ░███    ░███
//  ░███████████  ░██████████  ░██████████
//  ░███░░░░░███  ░███░░░░░░   ░███░░░░░░
//  ░███    ░███  ░███         ░███
//  █████   █████ █████        █████
// ░░░░░   ░░░░░ ░░░░░        ░░░░░

const FieldConfigSchema = Schema.declare(isFieldConfig, {
  identifier: "FieldConfig",
  description: "A valid Arrow field configuration",
});

export const CompactionConfiguration = Schema.Struct({
  freshnessSeconds: Schema.BigIntFromSelf,
  ttlSeconds: Schema.optional(Schema.BigIntFromSelf),
  targetFileSizeBytes: Schema.BigIntFromSelf,
});

export type CompactionConfiguration = typeof CompactionConfiguration.Type;

export const TopicCondition = Schema.Struct({
  type: Schema.String,
  status: Schema.Boolean,
  reason: Schema.String,
  message: Schema.String,
  lastTransitionTime: Schema.optional(Schema.Date),
});

export type TopicCondition = typeof TopicCondition.Type;

export const TopicStatus = Schema.Struct({
  numPartitions: Schema.BigIntFromSelf,
  conditions: Schema.Array(TopicCondition),
});

export type TopicStatus = typeof TopicStatus.Type;

export const Topic = Schema.Struct({
  name: Schema.String,
  schema: ArrowSchema,
  description: Schema.optional(Schema.String),
  partitionKey: Schema.optional(Schema.BigIntFromSelf),
  compaction: CompactionConfiguration,
  status: Schema.optional(TopicStatus),
});

export type Topic = typeof Topic.Type;

export const CreateTopicRequest = Schema.Struct({
  parent: Schema.String,
  topicId: Schema.String,
  fields: Schema.Array(FieldConfigSchema),
  description: Schema.optional(Schema.String),
  partitionKey: Schema.optional(Schema.BigIntFromSelf),
  compaction: CompactionConfiguration,
});

export type CreateTopicRequest = typeof CreateTopicRequest.Type;

const GetTopicRequestApp = Schema.Struct({
  name: Schema.String,
  view: Schema.optional(Schema.Enums(TopicView)),
});

const ListTopicsRequestApp = Schema.Struct({
  parent: Schema.String,
  pageSize: Schema.optional(Schema.Number),
  pageToken: Schema.optional(Schema.String),
});

export const ListTopicsResponse = Schema.Struct({
  topics: Schema.Array(Topic),
  nextPageToken: Schema.String,
});

export type ListTopicsResponse = typeof ListTopicsResponse.Type;

const DeleteTopicRequestApp = Schema.Struct({
  name: Schema.String,
  force: Schema.Boolean,
});

//  ███████████ ███████████     █████████   ██████   █████  █████████  ███████████    ███████    ███████████   ██████   ██████   █████████   ███████████ █████    ███████    ██████   █████
// ░█░░░███░░░█░░███░░░░░███   ███░░░░░███ ░░██████ ░░███  ███░░░░░███░░███░░░░░░█  ███░░░░░███ ░░███░░░░░███ ░░██████ ██████   ███░░░░░███ ░█░░░███░░░█░░███   ███░░░░░███ ░░██████ ░░███
// ░   ░███  ░  ░███    ░███  ░███    ░███  ░███░███ ░███ ░███    ░░░  ░███   █ ░  ███     ░░███ ░███    ░███  ░███░█████░███  ░███    ░███ ░   ░███  ░  ░███  ███     ░░███ ░███░███ ░███
//     ░███     ░██████████   ░███████████  ░███░░███░███ ░░█████████  ░███████   ░███      ░███ ░██████████   ░███░░███ ░███  ░███████████     ░███     ░███ ░███      ░███ ░███░░███░███
//     ░███     ░███░░░░░███  ░███░░░░░███  ░███ ░░██████  ░░░░░░░░███ ░███░░░█   ░███      ░███ ░███░░░░░███  ░███ ░░░  ░███  ░███░░░░░███     ░███     ░███ ░███      ░███ ░███ ░░██████
//     ░███     ░███    ░███  ░███    ░███  ░███  ░░█████  ███    ░███ ░███  ░    ░░███     ███  ░███    ░███  ░███      ░███  ░███    ░███     ░███     ░███ ░░███     ███  ░███  ░░█████
//     █████    █████   █████ █████   █████ █████  ░░█████░░█████████  █████       ░░░███████░   █████   █████ █████     █████ █████   █████    █████    █████ ░░░███████░   █████  ░░█████
//    ░░░░░    ░░░░░   ░░░░░ ░░░░░   ░░░░░ ░░░░░    ░░░░░  ░░░░░░░░░  ░░░░░          ░░░░░░░    ░░░░░   ░░░░░ ░░░░░     ░░░░░ ░░░░░   ░░░░░    ░░░░░    ░░░░░    ░░░░░░░    ░░░░░    ░░░░░

export const GetTopicRequest = Schema.transform(
  GetTopicRequestProto,
  GetTopicRequestApp,
  {
    strict: true,
    decode: (proto) => ({ name: proto.name, view: proto.view }),
    encode: (app) => ({
      $type: "wings.v1.cluster_metadata.GetTopicRequest" as const,
      name: app.name,
      view: app.view,
    }),
  },
);

export type GetTopicRequest = typeof GetTopicRequest.Type;

export const ListTopicsRequest = Schema.transform(
  ListTopicsRequestProto,
  ListTopicsRequestApp,
  {
    strict: true,
    decode: (proto) => ({
      parent: proto.parent,
      pageSize: proto.pageSize,
      pageToken: proto.pageToken,
    }),
    encode: (app) => ({
      $type: "wings.v1.cluster_metadata.ListTopicsRequest" as const,
      parent: app.parent,
      pageSize: app.pageSize,
      pageToken: app.pageToken,
    }),
  },
);

export type ListTopicsRequest = typeof ListTopicsRequest.Type;

export const DeleteTopicRequest = Schema.transform(
  DeleteTopicRequestProto,
  DeleteTopicRequestApp,
  {
    strict: true,
    decode: (proto) => ({ name: proto.name, force: proto.force }),
    encode: (app) => ({
      $type: "wings.v1.cluster_metadata.DeleteTopicRequest" as const,
      name: app.name,
      force: app.force,
    }),
  },
);

export type DeleteTopicRequest = typeof DeleteTopicRequest.Type;

//    █████████     ███████    ██████████   ██████████   █████████
//   ███░░░░░███  ███░░░░░███ ░░███░░░░███ ░░███░░░░░█  ███░░░░░███
//  ███     ░░░  ███     ░░███ ░███   ░░███ ░███  █ ░  ███     ░░░
// ░███         ░███      ░███ ░███    ░███ ░██████   ░███
// ░███         ░███      ░███ ░███    ░███ ░███░░█   ░███
// ░░███     ███░░███     ███  ░███    ███  ░███ ░   █░░███     ███
//  ░░█████████  ░░░███████░   ██████████   ██████████ ░░█████████
//   ░░░░░░░░░     ░░░░░░░    ░░░░░░░░░░   ░░░░░░░░░░   ░░░░░░░░░

export const Codec = {
  CompactionConfiguration: {
    toProto: (
      value: CompactionConfiguration,
    ): proto.CompactionConfiguration => ({
      $type: "wings.v1.cluster_metadata.CompactionConfiguration",
      freshnessSeconds: value.freshnessSeconds,
      ttlSeconds: value.ttlSeconds,
      targetFileSizeBytes: value.targetFileSizeBytes,
    }),
    fromProto: (
      value: proto.CompactionConfiguration,
    ): CompactionConfiguration => ({
      freshnessSeconds: value.freshnessSeconds,
      ttlSeconds: value.ttlSeconds,
      targetFileSizeBytes: value.targetFileSizeBytes,
    }),
  },

  Topic: {
    toProto: (value: Topic): proto.Topic => ({
      $type: "wings.v1.cluster_metadata.Topic",
      name: value.name,
      schema: ArrowTypeCodec.Schema.toProto(value.schema),
      description: value.description,
      partitionKey: value.partitionKey,
      compaction: Codec.CompactionConfiguration.toProto(value.compaction),
      status: value.status
        ? {
            $type: "wings.v1.cluster_metadata.TopicStatus",
            numPartitions: value.status.numPartitions,
            conditions: value.status.conditions.map(
              (condition: TopicCondition) => ({
                $type: "wings.v1.cluster_metadata.TopicCondition",
                type: condition.type,
                status: condition.status,
                reason: condition.reason,
                message: condition.message,
                lastTransitionTime: condition.lastTransitionTime,
              }),
            ),
          }
        : undefined,
    }),
    fromProto: (value: proto.Topic): Topic => {
      if (!value.compaction) {
        throw new Error("Topic compaction is undefined");
      }
      if (!value.schema) {
        throw new Error("Topic schema is undefined");
      }
      return {
        name: value.name,
        schema: ArrowTypeCodec.Schema.fromProto(value.schema),
        description: value.description,
        partitionKey: value.partitionKey,
        compaction: Codec.CompactionConfiguration.fromProto(value.compaction),
        status: value.status
          ? {
              numPartitions: value.status.numPartitions,
              conditions: value.status.conditions.map(
                (condition: proto.TopicCondition) => ({
                  type: condition.type,
                  status: condition.status,
                  reason: condition.reason,
                  message: condition.message,
                  lastTransitionTime: condition.lastTransitionTime,
                }),
              ),
            }
          : undefined,
      };
    },
  },

  CreateTopicRequest: {
    toProto: (value: CreateTopicRequest): proto.CreateTopicRequest => ({
      $type: "wings.v1.cluster_metadata.CreateTopicRequest",
      parent: value.parent,
      topicId: value.topicId,
      topic: {
        $type: "wings.v1.cluster_metadata.Topic",
        name: `${value.parent}/topics/${value.topicId}`,
        schema: arrowSchemaToProto(
          new ApacheArrowSchema(value.fields.map(createArrowField)),
        ),
        description: value.description,
        partitionKey: value.partitionKey,
        compaction: Codec.CompactionConfiguration.toProto(value.compaction),
        status: undefined,
      },
    }),
    fromProto: (value: proto.CreateTopicRequest): CreateTopicRequest => {
      if (!value.topic?.compaction) {
        throw new Error("Topic metadata is undefined");
      }
      if (!value.topic.schema) {
        throw new Error("Topic schema is undefined");
      }
      const schema = arrowSchemaFromProto(value.topic.schema);
      const fields = schema.fields.map(arrowFieldToFieldConfig);
      return {
        parent: value.parent,
        topicId: value.topicId,
        fields,
        description: value.topic.description,
        partitionKey: value.topic.partitionKey,
        compaction: Codec.CompactionConfiguration.fromProto(
          value.topic.compaction,
        ),
      };
    },
  },

  GetTopicRequest: {
    toProto: Schema.encodeSync(GetTopicRequest),
    fromProto: Schema.decodeSync(GetTopicRequest),
  },

  ListTopicsRequest: {
    toProto: Schema.encodeSync(ListTopicsRequest),
    fromProto: Schema.decodeSync(ListTopicsRequest),
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
    toProto: Schema.encodeSync(DeleteTopicRequest),
    fromProto: Schema.decodeSync(DeleteTopicRequest),
  },
} as const;
