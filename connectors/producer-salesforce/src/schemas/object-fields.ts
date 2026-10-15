import { Iceberg } from "@useairfoil/connector-kit";
import { Schema } from "effect";

import { field, list, version } from "./shared";

const PicklistValueSchema = Schema.Struct({
  value: Schema.String.pipe(field(103, "API value stored on records.")),
  label: Schema.NullOr(Schema.String).pipe(field(104, "Label shown in Salesforce.")),
  active: Schema.Boolean.pipe(field(105, "Whether the value can still be picked.")),
});

export const ObjectFieldSchema = Schema.Struct({
  id: Schema.String.pipe(field(1, "`<object>.<field>`, such as `Account.Industry`.")),
  version: version(2),
  object: Schema.String.pipe(field(3, "API name of the object.")),
  name: Schema.String.pipe(field(4, "API name of the field, the key in `fields`.")),
  label: Schema.String.pipe(field(5, "Label shown in Salesforce.")),
  type: Schema.String.pipe(field(6, "Salesforce field type, such as `picklist` or `currency`.")),
  custom: Schema.Boolean.pipe(field(7, "Whether the field is a custom field.")),
  calculated: Schema.Boolean.pipe(field(8, "Whether the field is a formula or roll-up.")),
  nillable: Schema.Boolean.pipe(field(9, "Whether the field can be empty.")),
  length: Schema.BigInt.pipe(field(10, "Maximum length of text fields.")),
  precision: Schema.BigInt.pipe(field(11, "Total digits of number fields.")),
  scale: Schema.BigInt.pipe(field(12, "Digits after the decimal point of number fields.")),
  reference_to: list(101, Schema.String).pipe(field(13, "Objects a lookup field can point to.")),
  picklist_values: list(102, PicklistValueSchema).pipe(
    field(14, "Values of picklist fields, active and inactive."),
  ),
})
  .annotate({
    description:
      "Field definitions of every synced object, to name the keys and values in `fields`.",
  })
  .pipe(Iceberg.identifier("id"));

export type ObjectField = Schema.Schema.Type<typeof ObjectFieldSchema>;
