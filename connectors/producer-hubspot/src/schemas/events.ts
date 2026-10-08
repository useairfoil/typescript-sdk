import { Schema } from "effect";

import { RecordId } from "./shared";

/**
 * One webhook event. `object.*` events name the object by `objectTypeId`, such
 * as `0-1`. `contact.privacyDeletion` has no type ID.
 */
export const HubSpotEventSchema = Schema.Struct({
  subscriptionType: Schema.String,
  portalId: Schema.Number,
  objectTypeId: Schema.optional(Schema.String),
  objectId: Schema.optional(RecordId),
  primaryObjectId: Schema.optional(RecordId),
  newObjectId: Schema.optional(RecordId),
  mergedObjectIds: Schema.optional(Schema.Array(RecordId)),
  fromObjectTypeId: Schema.optional(Schema.String),
  fromObjectId: Schema.optional(RecordId),
  toObjectTypeId: Schema.optional(Schema.String),
  toObjectId: Schema.optional(RecordId),
});

export type HubSpotEvent = Schema.Schema.Type<typeof HubSpotEventSchema>;

/**
 * HubSpot sends up to 100 events per request. They are decoded one by one
 * after the signature check, so an unknown shape skips that event only.
 */
export const WebhookPayloadSchema = Schema.Array(Schema.Unknown);
