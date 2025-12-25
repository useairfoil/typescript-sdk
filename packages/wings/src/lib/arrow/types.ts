import type { Field, Schema } from "apache-arrow";

export type DeserializedTopic = {
  name: string;
  description?: string;
  schema: Schema;
  fields: Field[];
  partitionKey?: number;
  compaction?: {
    freshnessSeconds: bigint;
    ttlSeconds?: bigint;
  };
};
