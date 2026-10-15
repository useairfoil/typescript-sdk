import { Iceberg } from "@useairfoil/connector-kit";
import { Schema, Struct } from "effect";

import { Long, Timestamp, field, list } from "./shared";

export const TalkLineSchema = Schema.Struct({
  id: Long.pipe(field(1, "Line ID.")),
  version: Schema.Date.pipe(field(2, "Time the line was read. Lines have no update time.")),
  created_at: Timestamp.pipe(field(3, "Time the line was added.")),
  line_type: Schema.String.pipe(field(4, "phone or digital.")),
  nickname: Schema.NullOr(Schema.String).pipe(field(5, "Line name.")),
  number: Schema.NullOr(Schema.String).pipe(field(6, "Phone number. Empty for digital lines.")),
  display_number: Schema.NullOr(Schema.String).pipe(field(7, "Phone number as shown.")),
  country_code: Schema.NullOr(Schema.String).pipe(field(8, "Country of the number.")),
  toll_free: Schema.NullOr(Schema.Boolean).pipe(field(9, "Whether the number is toll free.")),
  brand_id: Schema.NullOr(Long).pipe(field(10, "Brand of the line.")),
  default_group_id: Schema.NullOr(Long).pipe(field(11, "Group calls go to first.")),
  group_ids: list(101, Long).pipe(field(12, "Groups that take calls.")),
  priority: Long.pipe(field(13, "Priority of calls on the line.")),
  recorded: Schema.Boolean.pipe(field(14, "Whether calls are recorded.")),
  transcription: Schema.Boolean.pipe(field(15, "Whether voicemails are transcribed.")),
})
  .annotate({ description: "Zendesk Talk lines: phone numbers and digital lines." })
  .pipe(Iceberg.identifier("id"));

export type TalkLine = Schema.Schema.Type<typeof TalkLineSchema>;

// Digital lines leave out the phone number fields, and phone lines the brand.
export const TalkLineObjectSchema = TalkLineSchema.mapFields((fields) => ({
  ...Struct.omit(fields, [
    "version",
    "number",
    "display_number",
    "country_code",
    "toll_free",
    "brand_id",
  ]),
  brand_id: Schema.optional(fields.brand_id),
  number: Schema.optional(fields.number),
  display_number: Schema.optional(fields.display_number),
  country_code: Schema.optional(fields.country_code),
  toll_free: Schema.optional(fields.toll_free),
}));

export type TalkLineObject = Schema.Schema.Type<typeof TalkLineObjectSchema>;
