import { Effect, Schema } from "effect";

// Keep backfills older than webhook updates.
const initialVersion = "1970-01-01T00:00:00.000Z";

export const PostSchema = Schema.Struct({
  id: Schema.Number,
  userId: Schema.Number,
  title: Schema.String,
  body: Schema.String,
  version: Schema.String.pipe(Schema.withDecodingDefaultKey(Effect.succeed(initialVersion))),
});

export const PostEventSchema = Schema.Struct({
  type: Schema.Literals(["post.created", "post.updated"]),
  timestamp: Schema.String,
  data: PostSchema,
});

export const PostDeleteEventSchema = Schema.Struct({
  type: Schema.Literals(["post.deleted"]),
  timestamp: Schema.String,
  data: Schema.Struct({ id: Schema.Number }),
});

export const WebhookPayloadSchema = Schema.Union([PostEventSchema, PostDeleteEventSchema]);

export type Post = Schema.Schema.Type<typeof PostSchema>;
export type PostEvent = Schema.Schema.Type<typeof PostEventSchema>;
export type WebhookPayload = Schema.Schema.Type<typeof WebhookPayloadSchema>;
