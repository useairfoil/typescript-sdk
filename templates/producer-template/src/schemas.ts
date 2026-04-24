import * as Schema from "effect/Schema";

// Entity schema for a JSONPlaceholder post. JSONPlaceholder does not return a
// created_at timestamp, so we cursor on the numeric `id` field. When porting
// this template to a real API, replace `PostSchema` with your own struct and
// prefer a monotonically increasing cursor field (e.g. created_at).
export const PostSchema = Schema.Struct({
  id: Schema.Number,
  userId: Schema.Number,
  title: Schema.String,
  body: Schema.String,
});

export type Post = Schema.Schema.Type<typeof PostSchema>;

// Webhook payload union. JSONPlaceholder does not emit real webhooks, but the
// shape below mirrors what most SaaS APIs send. The handler in connector.ts
// uses the `type` discriminator to fan out to the right entity queue.
const PostEventSchema = Schema.Struct({
  type: Schema.Literals(["post.created", "post.updated"]),
  timestamp: Schema.String,
  data: PostSchema,
});

const IgnoredEventSchema = Schema.Struct({
  type: Schema.Literals(["post.deleted"]),
  timestamp: Schema.String,
  data: Schema.Any,
});

export const WebhookPayloadSchema = Schema.Union([
  PostEventSchema,
  IgnoredEventSchema,
]);

export type WebhookPayload = Schema.Schema.Type<typeof WebhookPayloadSchema>;
