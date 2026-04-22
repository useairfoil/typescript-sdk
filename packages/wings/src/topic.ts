import type { Schema } from "apache-arrow";

import type { Topic } from "./proto/wings/v1/cluster_metadata";

import { arrowSchemaFromProto, arrowSchemaToProto } from "./lib/arrow";
import { Schema as ProtoSchema } from "./proto/schema/arrow_type";

export function topicSchema(topic: Topic): Schema {
  if (!topic.schema) {
    throw new Error("Topic schema is undefined");
  }

  return arrowSchemaFromProto(topic.schema);
}

export function encodeTopicSchema(schema: Schema): Uint8Array {
  const protoSchema = arrowSchemaToProto(schema);
  return ProtoSchema.encode(protoSchema).finish();
}
