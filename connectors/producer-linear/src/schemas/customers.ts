import { Iceberg } from "@useairfoil/connector-kit";
import { Schema, Struct } from "effect";

import { Long, OptionalRef, OptionalString, Ref, common, deleted, field, list } from "./shared";

export const CustomerSchema = Schema.Struct({
  ...common("Customer"),
  _deleted: deleted("customer"),
  name: Schema.String.pipe(field(10, "Customer name.")),
  domains: list(101, Schema.String).pipe(field(11, "Email domains of the customer.")),
  external_ids: list(102, Schema.String).pipe(field(12, "IDs in other systems.")),
  logo_url: OptionalString.pipe(field(13, "Logo URL.")),
  owner_id: OptionalRef.pipe(field(14, "User who owns the customer.")),
  status_id: Ref.pipe(field(15, "Customer status.")),
  tier_id: OptionalRef.pipe(field(16, "Customer tier.")),
  revenue: Schema.NullOr(Long).pipe(field(17, "Annual revenue.")),
  size: Schema.NullOr(Schema.Finite).pipe(field(18, "Company size.")),
  approximate_need_count: Schema.Finite.pipe(field(19, "About how many requests it has.")),
  url: Schema.String.pipe(field(20, "Customer URL.")),
})
  .annotate({ description: "Linear customers." })
  .pipe(Iceberg.identifier("id"));

export type Customer = Schema.Schema.Type<typeof CustomerSchema>;

export const CustomerObjectSchema = CustomerSchema.mapFields((fields) =>
  Struct.omit(fields, ["version", "_deleted"]),
);

export const CustomerNeedSchema = Schema.Struct({
  ...common("Request"),
  _deleted: deleted("request"),
  customer_id: OptionalRef.pipe(field(10, "Customer.")),
  issue_id: OptionalRef.pipe(field(11, "Issue the request is linked to.")),
  project_id: OptionalRef.pipe(field(12, "Project the request is linked to.")),
  original_issue_id: OptionalRef.pipe(field(13, "Issue the request was first linked to.")),
  comment_id: OptionalRef.pipe(field(14, "Comment the request came from.")),
  attachment_id: OptionalRef.pipe(field(15, "Attachment the request came from.")),
  creator_id: OptionalRef.pipe(field(16, "User who added the request.")),
  body: OptionalString.pipe(field(17, "Request text in markdown.")),
  priority: Schema.Finite.pipe(field(18, "0 normal, 1 important.")),
  url: OptionalString.pipe(field(19, "Source URL.")),
})
  .annotate({ description: "Linear customer requests, linked to issues or projects." })
  .pipe(Iceberg.identifier("id"));

export type CustomerNeed = Schema.Schema.Type<typeof CustomerNeedSchema>;

export const CustomerNeedObjectSchema = CustomerNeedSchema.mapFields((fields) =>
  Struct.omit(fields, ["version", "_deleted"]),
);

const levelFields = (object: string) => ({
  ...common(object),
  name: Schema.String.pipe(field(10, "Name.")),
  display_name: Schema.String.pipe(field(11, "Name shown in Linear.")),
  description: OptionalString.pipe(field(12, "Description.")),
  color: Schema.String.pipe(field(13, "Color, as hex.")),
  position: Schema.Finite.pipe(field(14, "Order in the list.")),
});

export const CustomerStatusSchema = Schema.Struct(levelFields("Status"))
  .annotate({ description: "Linear customer statuses. Names the IDs in `customers.status_id`." })
  .pipe(Iceberg.identifier("id"));

export type CustomerStatus = Schema.Schema.Type<typeof CustomerStatusSchema>;

export const CustomerStatusObjectSchema = CustomerStatusSchema.mapFields((fields) =>
  Struct.omit(fields, ["version"]),
);

export const CustomerTierSchema = Schema.Struct(levelFields("Tier"))
  .annotate({ description: "Linear customer tiers. Names the IDs in `customers.tier_id`." })
  .pipe(Iceberg.identifier("id"));

export type CustomerTier = Schema.Schema.Type<typeof CustomerTierSchema>;

export const CustomerTierObjectSchema = CustomerTierSchema.mapFields((fields) =>
  Struct.omit(fields, ["version"]),
);
