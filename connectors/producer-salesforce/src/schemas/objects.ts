import { Iceberg } from "@useairfoil/connector-kit";
import { Schema } from "effect";

import { deleted, field, stringMap, version } from "./shared";

// Every object table has the same fields and IDs.
const objectFields = {
  id: Schema.String.pipe(field(1, "Salesforce record ID, 18 characters.")),
  version: version(2),
  created_at: Schema.NullOr(Schema.Date).pipe(
    field(3, "`CreatedDate`. Null for objects without it."),
  ),
  updated_at: Schema.NullOr(Schema.Date).pipe(
    field(
      4,
      "`SystemModstamp`. Null for objects without it. Cross-object formulas can change without it.",
    ),
  ),
  fields: stringMap(101, 102).pipe(
    field(5, "Every non-null field the connector can read, by API name, as a string."),
  ),
  _deleted: deleted(6),
};

export const objectSchema = (object: string) =>
  Schema.Struct(objectFields)
    .annotate({ description: `Salesforce ${object} records.` })
    .pipe(Iceberg.identifier("id"));

export type ObjectRow = Schema.Schema.Type<ReturnType<typeof objectSchema>>;

export const CustomObjectSchema = Schema.Struct({
  ...objectFields,
  object: Schema.String.pipe(field(7, "API name of the custom object, such as `Invoice__c`.")),
})
  .annotate({ description: "Records of every Salesforce custom object." })
  .pipe(Iceberg.identifier("id"));

export type CustomObject = Schema.Schema.Type<typeof CustomObjectSchema>;
