import { Schema } from "effect";

// Only the object ID is read, so events from any API version decode.
export const StripeEventSchema = Schema.Struct({
  id: Schema.String,
  type: Schema.String,
  created: Schema.Int,
  data: Schema.Struct({
    object: Schema.Struct({ id: Schema.String }),
  }),
});

export type StripeEvent = Schema.Schema.Type<typeof StripeEventSchema>;

/**
 * Any event in the account's event list. Some have no object ID, such as
 * `invoice.upcoming`, so the ID is only required once an event is routed to a
 * resource.
 */
export const StripeEventEnvelopeSchema = Schema.Struct({
  id: Schema.String,
  type: Schema.String,
  created: Schema.Int,
  data: Schema.Struct({
    object: Schema.Struct({ id: Schema.optional(Schema.String) }),
  }),
});

export type StripeEventEnvelope = Schema.Schema.Type<typeof StripeEventEnvelopeSchema>;

/** Returned when fetching a deleted customer. Other deleted objects return `404`. */
export const DeletedObjectSchema = Schema.Struct({
  id: Schema.String,
  deleted: Schema.Literal(true),
});
