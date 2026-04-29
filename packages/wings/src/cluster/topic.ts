import { Schema as ApacheArrowSchema } from "apache-arrow";
import { Schema, SchemaTransformation } from "effect";

import { WingsDecodeError } from "../errors";
import {
  arrowFieldToFieldConfig,
  arrowSchemaFromProto,
  arrowSchemaToProto,
  createArrowField,
  type FieldConfig,
} from "../lib/arrow";
import { TopicView } from "../proto/wings/v1/cluster_metadata";
import { Codec as ArrowCodec, ArrowSchema } from "./arrow-type";

export { TopicView };

//  ███████████  ███████████      ███████    ███████████    ███████
// ░░███░░░░░███░░███░░░░░███   ███░░░░░███ ░█░░░███░░░█  ███░░░░░███
//  ░███    ░███ ░███    ░███  ███     ░░███░   ░███  ░  ███     ░░███
//  ░██████████  ░██████████  ░███      ░███    ░███    ░███      ░███
//  ░███░░░░░░   ░███░░░░░███ ░███      ░███    ░███    ░███      ░███
//  ░███         ░███    ░███ ░░███     ███     ░███    ░░███     ███
//  █████        █████   █████ ░░░███████░      █████    ░░░███████░
// ░░░░░        ░░░░░   ░░░░░    ░░░░░░░       ░░░░░       ░░░░░░░

const GetTopicRequestProto = Schema.Struct({
  $type: Schema.Literal("wings.v1.cluster_metadata.GetTopicRequest"),
  name: Schema.String,
  view: Schema.optional(Schema.Enum(TopicView)),
});

type GetTopicRequestProto = typeof GetTopicRequestProto.Type;

const ListTopicsRequestProto = Schema.Struct({
  $type: Schema.Literal("wings.v1.cluster_metadata.ListTopicsRequest"),
  parent: Schema.String,
  pageSize: Schema.optional(Schema.Number),
  pageToken: Schema.optional(Schema.String),
});

type ListTopicsRequestProto = typeof ListTopicsRequestProto.Type;

const DeleteTopicRequestProto = Schema.Struct({
  $type: Schema.Literal("wings.v1.cluster_metadata.DeleteTopicRequest"),
  name: Schema.String,
  force: Schema.Boolean,
});

type DeleteTopicRequestProto = typeof DeleteTopicRequestProto.Type;

const CompactionConfigurationProto = Schema.Struct({
  $type: Schema.Literal("wings.v1.cluster_metadata.CompactionConfiguration"),
  freshnessSeconds: Schema.BigInt,
  ttlSeconds: Schema.optional(Schema.BigInt),
  targetFileSizeBytes: Schema.BigInt,
});

type CompactionConfigurationProto = typeof CompactionConfigurationProto.Type;

const TopicConditionProto = Schema.Struct({
  $type: Schema.Literal("wings.v1.cluster_metadata.TopicCondition"),
  type: Schema.String,
  status: Schema.Boolean,
  reason: Schema.String,
  message: Schema.String,
  lastTransitionTime: Schema.optional(Schema.Date),
});

type TopicConditionProto = typeof TopicConditionProto.Type;

const TopicStatusProto = Schema.Struct({
  $type: Schema.Literal("wings.v1.cluster_metadata.TopicStatus"),
  numPartitions: Schema.BigInt,
  conditions: Schema.Array(TopicConditionProto),
});

type TopicStatusProto = typeof TopicStatusProto.Type;

const TopicProto = Schema.Struct({
  $type: Schema.Literal("wings.v1.cluster_metadata.Topic"),
  name: Schema.String,
  schema: Schema.optional(Schema.Any),
  description: Schema.optional(Schema.String),
  partitionKey: Schema.optional(Schema.BigInt),
  compaction: Schema.optional(CompactionConfigurationProto),
  status: Schema.optional(TopicStatusProto),
});

type TopicProto = typeof TopicProto.Type;

const CreateTopicRequestProto = Schema.Struct({
  $type: Schema.Literal("wings.v1.cluster_metadata.CreateTopicRequest"),
  parent: Schema.String,
  topicId: Schema.String,
  topic: Schema.optional(TopicProto),
});

type CreateTopicRequestProto = typeof CreateTopicRequestProto.Type;

const ListTopicsResponseProto = Schema.Struct({
  $type: Schema.Literal("wings.v1.cluster_metadata.ListTopicsResponse"),
  topics: Schema.Array(TopicProto),
  nextPageToken: Schema.String,
});

type ListTopicsResponseProto = typeof ListTopicsResponseProto.Type;

//    █████████   ███████████  ███████████
//   ███░░░░░███ ░░███░░░░░███░░███░░░░░███
//  ░███    ░███  ░███    ░███ ░███    ░███
//  ░███████████  ░██████████  ░██████████
//  ░███░░░░░███  ░███░░░░░░   ░███░░░░░░
//  ░███    ░███  ░███         ░███
//  █████   █████ █████        █████
// ░░░░░   ░░░░░ ░░░░░        ░░░░░

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

const FieldConfigSchema = Schema.declare(isFieldConfig, {
  identifier: "FieldConfig",
  description: "A valid Arrow field configuration",
});

const CompactionConfigurationApp = Schema.Struct({
  freshnessSeconds: Schema.BigInt,
  ttlSeconds: Schema.optional(Schema.BigInt),
  targetFileSizeBytes: Schema.BigInt,
});

type CompactionConfigurationApp = typeof CompactionConfigurationApp.Type;

const TopicConditionApp = Schema.Struct({
  type: Schema.String,
  status: Schema.Boolean,
  reason: Schema.String,
  message: Schema.String,
  lastTransitionTime: Schema.optional(Schema.Date),
});

type TopicConditionApp = typeof TopicConditionApp.Type;

const TopicStatusApp = Schema.Struct({
  numPartitions: Schema.BigInt,
  conditions: Schema.Array(TopicConditionApp),
});

type TopicStatusApp = typeof TopicStatusApp.Type;

const TopicApp = Schema.Struct({
  name: Schema.String,
  schema: ArrowSchema,
  description: Schema.optional(Schema.String),
  partitionKey: Schema.optional(Schema.BigInt),
  compaction: CompactionConfigurationApp,
  status: Schema.optional(TopicStatusApp),
});

type TopicApp = typeof TopicApp.Type;

const CreateTopicRequestApp = Schema.Struct({
  parent: Schema.String,
  topicId: Schema.String,
  fields: Schema.mutable(Schema.Array(FieldConfigSchema)),
  description: Schema.optional(Schema.String),
  partitionKey: Schema.optional(Schema.BigInt),
  compaction: CompactionConfigurationApp,
});

type CreateTopicRequestApp = typeof CreateTopicRequestApp.Type;

const GetTopicRequestApp = Schema.Struct({
  name: Schema.String,
  view: Schema.optional(Schema.Enum(TopicView)),
});

type GetTopicRequestApp = typeof GetTopicRequestApp.Type;

const ListTopicsRequestApp = Schema.Struct({
  parent: Schema.String,
  pageSize: Schema.optional(Schema.Number),
  pageToken: Schema.optional(Schema.String),
});

type ListTopicsRequestApp = typeof ListTopicsRequestApp.Type;

const ListTopicsResponseApp = Schema.Struct({
  topics: Schema.Array(TopicApp),
  nextPageToken: Schema.String,
});

type ListTopicsResponseApp = typeof ListTopicsResponseApp.Type;

const DeleteTopicRequestApp = Schema.Struct({
  name: Schema.String,
  force: Schema.Boolean,
});

type DeleteTopicRequestApp = typeof DeleteTopicRequestApp.Type;

//  ███████████ ███████████     █████████   ██████   █████  █████████  ███████████    ███████    ███████████   ██████   ██████   █████████   ███████████ █████    ███████    ██████   █████
// ░█░░░███░░░█░░███░░░░░███   ███░░░░░███ ░░██████ ░░███  ███░░░░░███░░███░░░░░░█  ███░░░░░███ ░░███░░░░░███ ░░██████ ██████   ███░░░░░███ ░█░░░███░░░█░░███   ███░░░░░███ ░░██████ ░░███
// ░   ░███  ░  ░███    ░███  ░███    ░███  ░███░███ ░███ ░███    ░░░  ░███   █ ░  ███     ░░███ ░███    ░███  ░███░█████░███  ░███    ░███ ░   ░███  ░  ░███  ███     ░░███ ░███░███ ░███
//     ░███     ░██████████   ░███████████  ░███░░███░███ ░░█████████  ░███████   ░███      ░███ ░██████████   ░███░░███ ░███  ░███████████     ░███     ░███ ░███      ░███ ░███░░███░███
//     ░███     ░███░░░░░███  ░███░░░░░███  ░███ ░░██████  ░░░░░░░░███ ░███░░░█   ░███      ░███ ░███░░░░░███  ░███ ░░░  ░███  ░███░░░░░███     ░███     ░███ ░███      ░███ ░███ ░░██████
//     ░███     ░███    ░███  ░███    ░███  ░███  ░░█████  ███    ░███ ░███  ░    ░░███     ███  ░███    ░███  ░███      ░███  ░███    ░███     ░███     ░███ ░░███     ███  ░███  ░░█████
//     █████    █████   █████ █████   █████ █████  ░░█████░░█████████  █████       ░░░███████░   █████   █████ █████     █████ █████   █████    █████    █████ ░░░███████░   █████  ░░█████
//    ░░░░░    ░░░░░   ░░░░░ ░░░░░   ░░░░░ ░░░░░    ░░░░░  ░░░░░░░░░  ░░░░░          ░░░░░░░    ░░░░░   ░░░░░ ░░░░░     ░░░░░ ░░░░░   ░░░░░    ░░░░░    ░░░░░    ░░░░░░░    ░░░░░    ░░░░░

export const TopicCondition = TopicConditionProto.pipe(
  Schema.decodeTo(
    TopicConditionApp,
    SchemaTransformation.transform({
      decode: (proto): TopicConditionApp => ({
        type: proto.type,
        status: proto.status,
        reason: proto.reason,
        message: proto.message,
        lastTransitionTime: proto.lastTransitionTime,
      }),
      encode: (app): TopicConditionProto => ({
        $type: "wings.v1.cluster_metadata.TopicCondition" as const,
        type: app.type,
        status: app.status,
        reason: app.reason,
        message: app.message,
        lastTransitionTime: app.lastTransitionTime,
      }),
    }),
  ),
);

export type TopicCondition = typeof TopicCondition.Type;

export const TopicStatus = TopicStatusProto.pipe(
  Schema.decodeTo(
    TopicStatusApp,
    SchemaTransformation.transform({
      decode: (proto): TopicStatusApp => ({
        numPartitions: proto.numPartitions,
        conditions: proto.conditions.map((condition) =>
          Schema.decodeSync(TopicCondition)(condition),
        ),
      }),
      encode: (app): TopicStatusProto => ({
        $type: "wings.v1.cluster_metadata.TopicStatus" as const,
        numPartitions: app.numPartitions,
        conditions: app.conditions.map((condition) => Schema.encodeSync(TopicCondition)(condition)),
      }),
    }),
  ),
);

export type TopicStatus = typeof TopicStatus.Type;

export const CompactionConfiguration = CompactionConfigurationProto.pipe(
  Schema.decodeTo(
    CompactionConfigurationApp,
    SchemaTransformation.transform({
      decode: (p): CompactionConfigurationApp => ({
        freshnessSeconds: p.freshnessSeconds,
        ttlSeconds: p.ttlSeconds,
        targetFileSizeBytes: p.targetFileSizeBytes,
      }),
      encode: (app): CompactionConfigurationProto => ({
        $type: "wings.v1.cluster_metadata.CompactionConfiguration" as const,
        freshnessSeconds: app.freshnessSeconds,
        ttlSeconds: app.ttlSeconds,
        targetFileSizeBytes: app.targetFileSizeBytes,
      }),
    }),
  ),
);

export type CompactionConfiguration = typeof CompactionConfiguration.Type;

export const Topic = TopicProto.pipe(
  Schema.decodeTo(
    TopicApp,
    SchemaTransformation.transform({
      decode: (proto): TopicApp => {
        if (!proto.schema) {
          throw new WingsDecodeError("Topic schema is undefined");
        }
        if (!proto.compaction) {
          throw new WingsDecodeError("Topic compaction is undefined");
        }
        return {
          name: proto.name,
          schema: ArrowCodec.ArrowSchema.fromProto(proto.schema),
          description: proto.description,
          partitionKey: proto.partitionKey,
          compaction: Schema.decodeSync(CompactionConfiguration)(proto.compaction),
          status: proto.status ? Schema.decodeSync(TopicStatus)(proto.status) : undefined,
        };
      },
      encode: (app): TopicProto => ({
        $type: "wings.v1.cluster_metadata.Topic" as const,
        name: app.name,
        schema: ArrowCodec.ArrowSchema.toProto(app.schema),
        description: app.description,
        partitionKey: app.partitionKey,
        compaction: Schema.encodeSync(CompactionConfiguration)(app.compaction),
        status: app.status ? Schema.encodeSync(TopicStatus)(app.status) : undefined,
      }),
    }),
  ),
);

export type Topic = typeof Topic.Type;

export const GetTopicRequest = GetTopicRequestProto.pipe(
  Schema.decodeTo(
    GetTopicRequestApp,
    SchemaTransformation.transform({
      decode: (proto): GetTopicRequestApp => ({
        name: proto.name,
        view: proto.view,
      }),
      encode: (app): GetTopicRequestProto => ({
        $type: "wings.v1.cluster_metadata.GetTopicRequest" as const,
        name: app.name,
        view: app.view,
      }),
    }),
  ),
);

export type GetTopicRequest = typeof GetTopicRequest.Type;

export const ListTopicsRequest = ListTopicsRequestProto.pipe(
  Schema.decodeTo(
    ListTopicsRequestApp,
    SchemaTransformation.transform({
      decode: (proto): ListTopicsRequestApp => ({
        parent: proto.parent,
        pageSize: proto.pageSize,
        pageToken: proto.pageToken,
      }),
      encode: (app): ListTopicsRequestProto => ({
        $type: "wings.v1.cluster_metadata.ListTopicsRequest" as const,
        parent: app.parent,
        pageSize: app.pageSize,
        pageToken: app.pageToken,
      }),
    }),
  ),
);

export type ListTopicsRequest = typeof ListTopicsRequest.Type;

export const DeleteTopicRequest = DeleteTopicRequestProto.pipe(
  Schema.decodeTo(
    DeleteTopicRequestApp,
    SchemaTransformation.transform({
      decode: (proto): DeleteTopicRequestApp => ({
        name: proto.name,
        force: proto.force,
      }),
      encode: (app): DeleteTopicRequestProto => ({
        $type: "wings.v1.cluster_metadata.DeleteTopicRequest" as const,
        name: app.name,
        force: app.force,
      }),
    }),
  ),
);

export type DeleteTopicRequest = typeof DeleteTopicRequest.Type;

export const CreateTopicRequest = CreateTopicRequestProto.pipe(
  Schema.decodeTo(
    CreateTopicRequestApp,
    SchemaTransformation.transform({
      decode: (proto): CreateTopicRequestApp => {
        if (!proto.topic?.compaction) {
          throw new WingsDecodeError("Topic metadata is undefined");
        }
        if (!proto.topic.schema) {
          throw new WingsDecodeError("Topic schema is undefined");
        }
        const schema = arrowSchemaFromProto(proto.topic.schema);
        return {
          parent: proto.parent,
          topicId: proto.topicId,
          fields: Array.from(schema.fields.map(arrowFieldToFieldConfig)),
          description: proto.topic.description,
          partitionKey: proto.topic.partitionKey,
          compaction: Schema.decodeSync(CompactionConfiguration)(proto.topic.compaction),
        };
      },
      encode: (app): CreateTopicRequestProto => ({
        $type: "wings.v1.cluster_metadata.CreateTopicRequest" as const,
        parent: app.parent,
        topicId: app.topicId,
        topic: {
          $type: "wings.v1.cluster_metadata.Topic" as const,
          name: `${app.parent}/topics/${app.topicId}`,
          schema: arrowSchemaToProto(new ApacheArrowSchema(app.fields.map(createArrowField))),
          description: app.description,
          partitionKey: app.partitionKey,
          compaction: Schema.encodeSync(CompactionConfiguration)(app.compaction),
          status: undefined,
        },
      }),
    }),
  ),
);

export type CreateTopicRequest = typeof CreateTopicRequest.Type;

export const ListTopicsResponse = ListTopicsResponseProto.pipe(
  Schema.decodeTo(
    ListTopicsResponseApp,
    SchemaTransformation.transform({
      decode: (proto): ListTopicsResponseApp => ({
        topics: proto.topics.map((topic) => Schema.decodeSync(Topic)(topic)),
        nextPageToken: proto.nextPageToken,
      }),
      encode: (app): ListTopicsResponseProto => ({
        $type: "wings.v1.cluster_metadata.ListTopicsResponse" as const,
        topics: app.topics.map((topic) => Schema.encodeSync(Topic)(topic)),
        nextPageToken: app.nextPageToken,
      }),
    }),
  ),
);

export type ListTopicsResponse = typeof ListTopicsResponse.Type;

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
    toProto: Schema.encodeSync(CompactionConfiguration),
    fromProto: Schema.decodeSync(CompactionConfiguration),
  },

  Topic: {
    toProto: Schema.encodeSync(Topic),
    fromProto: Schema.decodeSync(Topic),
  },

  CreateTopicRequest: {
    toProto: Schema.encodeSync(CreateTopicRequest),
    fromProto: Schema.decodeSync(CreateTopicRequest),
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
    toProto: Schema.encodeSync(ListTopicsResponse),
    fromProto: Schema.decodeSync(ListTopicsResponse),
  },

  DeleteTopicRequest: {
    toProto: Schema.encodeSync(DeleteTopicRequest),
    fromProto: Schema.decodeSync(DeleteTopicRequest),
  },
} as const;
