import { Schema, SchemaTransformation, type Types } from "effect";

import type { ConfigFieldSpec } from "./config";
import type { ConnectorManifest } from "./manifest";

type FieldValueOf<Field extends ConfigFieldSpec> = Field["type"] extends "number"
  ? number
  : Field["type"] extends "boolean"
    ? boolean
    : Field["values"] extends ReadonlyArray<string>
      ? Field["values"][number]
      : string;

export type ConnectorConfigValues<Manifest extends ConnectorManifest> = Types.Simplify<
  {
    readonly [Field in Manifest["config"][number] as Field["required"] extends true
      ? Field["name"]
      : never]: FieldValueOf<Field>;
  } & {
    readonly [Field in Manifest["config"][number] as Field["required"] extends true
      ? never
      : Field["name"]]?: FieldValueOf<Field> | undefined;
  }
>;

export type ConnectorConfigSchema<Manifest extends ConnectorManifest> = Schema.Codec<
  ConnectorConfigValues<Manifest>,
  unknown
>;

const NonEmptyString = Schema.String.check(
  Schema.isNonEmpty({ message: "This field is required" }),
);

const NumberFromForm = Schema.Union([
  Schema.Finite,
  NonEmptyString.pipe(Schema.decodeTo(Schema.Finite, SchemaTransformation.numberFromString)),
]);

const BooleanFromForm = Schema.Union([
  Schema.Boolean,
  Schema.Literals(["true", "false"]).pipe(
    Schema.decodeTo(
      Schema.Boolean,
      SchemaTransformation.transform({
        decode: (value) => value === "true",
        encode: (value) => (value ? "true" : "false"),
      }),
    ),
  ),
]);

const EmptyStringAsUndefined = Schema.Literal("").pipe(
  Schema.decodeTo(
    Schema.Undefined,
    SchemaTransformation.transform({ decode: () => undefined, encode: () => "" }),
  ),
);

const baseFieldSchema = (field: ConfigFieldSpec): Schema.Codec<unknown, unknown> => {
  switch (field.type) {
    case "number":
      return NumberFromForm;
    case "boolean":
      return BooleanFromForm;
    case "select":
      return Schema.Literals(field.values ?? []);
    case "string":
      return NonEmptyString;
  }
};

const fieldSchema = (field: ConfigFieldSpec) =>
  field.required
    ? baseFieldSchema(field)
    : Schema.optional(Schema.Union([EmptyStringAsUndefined, baseFieldSchema(field)]));

export const configSchema = <const Manifest extends ConnectorManifest>(
  manifest: Manifest,
): ConnectorConfigSchema<Manifest> =>
  Schema.Struct(
    Object.fromEntries(manifest.config.map((field) => [field.name, fieldSchema(field)])),
  ) as unknown as ConnectorConfigSchema<Manifest>;
