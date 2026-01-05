import { Schema } from "apache-arrow";
import { Schema as _Schema } from "apache-arrow/fb/schema";
import { toUint8Array } from "apache-arrow/util/buffer";
import * as flatbuffers from "flatbuffers";
import type { Topic } from "./proto/cluster_metadata";

export function topicSchema(topic: Topic): Schema {
  const byteBuffer = new flatbuffers.ByteBuffer(toUint8Array(topic.fields));
  const _schema = _Schema.getRootAsSchema(byteBuffer);
  return Schema.decode(_schema);
}

export function encodeTopicSchema(schema: Schema): Uint8Array {
  const builder = new flatbuffers.Builder();
  const schemaOffset = Schema.encode(builder, schema);
  builder.finish(schemaOffset);
  return builder.asUint8Array();
}
