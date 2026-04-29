import type { Schema } from "apache-arrow";

import { Effect } from "effect";

import type { Topic } from "./proto/wings/v1/cluster_metadata";

import { WingsDecodeError, WingsError } from "./errors";
import { arrowSchemaFromProto, arrowSchemaToProto } from "./lib/arrow";
import { Schema as ProtoSchema } from "./proto/schema/arrow_type";

/**
 * Returns a topic's Arrow schema synchronously.
 * Use this in places where missing schema data should fail immediately.
 */
export function topicSchemaUnsafe(topic: Topic): Schema {
  if (!topic.schema) {
    throw new WingsDecodeError("Topic schema is undefined");
  }

  return arrowSchemaFromProto(topic.schema);
}

/**
 * Decodes a topic's Arrow schema into an `Effect`.
 * This is the recommended entry point when the topic comes from external data.
 */
export const topicSchema = (topic: Topic) =>
  Effect.try({
    try: () => topicSchemaUnsafe(topic),
    catch: (cause) =>
      new WingsError({
        message: "Failed to decode topic schema",
        cause,
      }),
  });

/** Serializes an Arrow schema into the bytes used by Wings APIs. */
export function encodeTopicSchema(schema: Schema): Uint8Array {
  const protoSchema = arrowSchemaToProto(schema);
  return ProtoSchema.encode(protoSchema).finish();
}
