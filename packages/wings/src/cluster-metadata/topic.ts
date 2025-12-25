import type { Codec, CodecType } from "../lib/codec";
import type * as proto from "../proto/cluster_metadata";

export const CompactionConfiguration: Codec<
  {
    /** How often to compact the topic, in seconds. */
    freshnessSeconds: bigint;
    /** How long to keep the topic data, in seconds. */
    ttlSeconds?: bigint;
  },
  proto.CompactionConfiguration
> = {
  encode(value) {
    return {
      $type: "wings.v1.cluster_metadata.CompactionConfiguration",
      freshnessSeconds: value.freshnessSeconds,
      ttlSeconds: value.ttlSeconds,
    };
  },
  decode(value) {
    return {
      freshnessSeconds: value.freshnessSeconds,
      ttlSeconds: value.ttlSeconds,
    };
  },
};

export type CompactionConfiguration = CodecType<typeof CompactionConfiguration>;

export const CreateTopicRequest: Codec<
  {
    /**
     * The namespace that owns the topic.
     *
     * Format: tenants/{tenant}/namespaces/{namespace}
     */
    parent: string;
    /** The topic id. */
    topicId: string;
    /** The fields in the topic messages. */
    fields: Uint8Array;
    /** The topic description. */
    description?: string;
    /** The index of the field that is used to partition the topic. */
    partitionKey?: number;
    /** The topic compaction configuration. */
    compaction: CompactionConfiguration;
  },
  proto.CreateTopicRequest
> = {
  encode(value) {
    return {
      $type: "wings.v1.cluster_metadata.CreateTopicRequest",
      parent: value.parent,
      topicId: value.topicId,
      topic: Topic.encode({
        name: `${value.parent}/topics/${value.topicId}`,
        fields: value.fields,
        description: value.description,
        partitionKey: value.partitionKey,
        compaction: value.compaction,
      }),
    };
  },
  decode(value) {
    if (value.topic === undefined) {
      throw new Error("Topic metadata is undefined");
    }

    const decoded = Topic.decode(value.topic);
    return {
      parent: value.parent,
      topicId: value.topicId,
      fields: decoded.fields,
      description: decoded.description,
      partitionKey: decoded.partitionKey,
      compaction: decoded.compaction,
    };
  },
};

export type CreateTopicRequest = CodecType<typeof CreateTopicRequest>;

export const GetTopicRequest: Codec<
  {
    /**
     * The topic name.
     *
     * Format: tenants/{tenant}/namespaces/{namespace}/topics/{topic}
     */
    name: string;
  },
  proto.GetTopicRequest
> = {
  encode(value) {
    return {
      $type: "wings.v1.cluster_metadata.GetTopicRequest",
      name: value.name,
    };
  },
  decode(value) {
    return {
      name: value.name,
    };
  },
};

export type GetTopicRequest = CodecType<typeof GetTopicRequest>;

export const ListTopicsRequest: Codec<
  {
    /**
     * The parent namespace.
     *
     * Format: tenants/{tenant}/namespaces/{namespace}
     */
    parent: string;
    /** The number of topics to return. */
    pageSize?: number;
    /** The continuation token. */
    pageToken?: string;
  },
  proto.ListTopicsRequest
> = {
  encode(value) {
    return {
      $type: "wings.v1.cluster_metadata.ListTopicsRequest",
      parent: value.parent,
      pageSize: value.pageSize,
      pageToken: value.pageToken,
    };
  },
  decode(value) {
    return {
      parent: value.parent,
      pageSize: value.pageSize,
      pageToken: value.pageToken,
    };
  },
};

export type ListTopicsRequest = CodecType<typeof ListTopicsRequest>;

export const ListTopicsResponse: Codec<
  {
    /** The topics. */
    topics: Topic[];
    /** The continuation token. */
    nextPageToken: string;
  },
  proto.ListTopicsResponse
> = {
  encode(value) {
    return {
      $type: "wings.v1.cluster_metadata.ListTopicsResponse",
      topics: value.topics.map(Topic.encode),
      nextPageToken: value.nextPageToken,
    };
  },
  decode(value) {
    return {
      topics: value.topics.map(Topic.decode),
      nextPageToken: value.nextPageToken,
    };
  },
};

export type ListTopicsResponse = CodecType<typeof ListTopicsResponse>;

export const DeleteTopicRequest: Codec<
  {
    /**
     * The topic name.
     *
     * Format: tenants/{tenant}/namespaces/{namespace}/topics/{topic}
     */
    name: string;
    /** If set to true, also delete data associated with the topic. */
    force: boolean;
  },
  proto.DeleteTopicRequest
> = {
  encode(value) {
    return {
      $type: "wings.v1.cluster_metadata.DeleteTopicRequest",
      name: value.name,
      force: value.force,
    };
  },
  decode(value) {
    return {
      name: value.name,
      force: value.force,
    };
  },
};

export type DeleteTopicRequest = CodecType<typeof DeleteTopicRequest>;

export const Topic: Codec<
  {
    /**
     * The topic name.
     *
     * Format: tenants/{tenant}/namespaces/{namespace}/topics/{topic}
     */
    name: string;
    /** The fields in the topic messages. */
    fields: Uint8Array;
    /** The topic description. */
    description?: string;
    /** The index of the field that is used to partition the topic. */
    partitionKey?: number;
    /** The topic compaction configuration. */
    compaction: CompactionConfiguration;
  },
  proto.Topic
> = {
  encode(value) {
    return {
      $type: "wings.v1.cluster_metadata.Topic",
      name: value.name,
      fields: value.fields,
      description: value.description,
      partitionKey: value.partitionKey,
      compaction: CompactionConfiguration.encode(value.compaction),
    };
  },
  decode(value) {
    if (value.compaction === undefined) {
      throw new Error("CompactionConfiguration is undefined");
    }
    return {
      name: value.name,
      fields: value.fields,
      description: value.description,
      partitionKey: value.partitionKey,
      compaction: CompactionConfiguration.decode(value.compaction),
    };
  },
};

export type Topic = CodecType<typeof Topic>;
