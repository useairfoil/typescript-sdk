import type * as Schema from "effect/Schema";

import * as SchemaAST from "effect/SchemaAST";

import type { ArrowSchema, ArrowType, Field } from "../cluster/arrow-type";

import {
  FieldId,
  FieldMetadata,
  type PrimitiveArrowTypeTag,
  SchemaMetadata,
  WingsNullable,
  WingsType,
  type WingsTypeAnnotation,
} from "./wings-annotations";

/**
 * Converts a Wings Struct schema into a Wings ArrowSchema.
 */
export function schemaConverter<F extends Schema.Struct.Fields>(
  structSchema: Schema.Struct<F>,
): ArrowSchema {
  return {
    fields: convertStructFields(structSchema.fields, "root"),
    metadata: readSchemaMetadata(structSchema),
  };
}

/**
 * Converts a map of struct fields into Wings Arrow fields.
 */
function convertStructFields(fields: Schema.Struct.Fields, path: string): Field[] {
  return Reflect.ownKeys(fields).map((key) => {
    const schema = fields[key];
    return convertField(String(key), schema, path);
  });
}

/**
 * Converts a single Wings schema into an Wings Arrow field.
 */
function convertField(name: string, schema: Schema.Top, path: string): Field {
  const id = readFieldId(schema, `${path}.${name}`);
  const arrowType = mapEffectTypeToArrow(schema, `${path}.${name}`);
  return {
    name,
    id,
    arrowType,
    nullable: readNullable(schema),
    metadata: readFieldMetadata(schema),
  };
}

/**
 * Maps a Wings schema to the corresponding Wings Arrow type.
 */
function mapEffectTypeToArrow(schema: Schema.Top, path: string): ArrowType {
  const annotation = readWingsTypeAnnotation(schema);
  if (annotation) {
    switch (annotation._tag) {
      case "primitive":
        return primitiveArrowType(annotation.type);
      case "timestamp":
        return {
          _tag: "timestamp",
          timestamp: {
            timeUnit: annotation.timeUnit,
            timezone: annotation.timezone ?? "",
          },
        };
      case "duration":
        return { _tag: "duration", duration: annotation.timeUnit };
      case "list":
        return {
          _tag: "list",
          list: {
            fieldType: convertListItem(annotation.item, `${path}.item`),
          },
        };
    }
  }

  if (isStructSchema(schema)) {
    return {
      _tag: "struct",
      struct: {
        subFieldTypes: convertStructFields(schema.fields, path),
      },
    };
  }

  throw new Error(`Unsupported schema for "${path}". Use Wings types or Schema.Struct.`);
}

/**
 * Converts the list item schema into the Wings Arrow list field definition.
 */
function convertListItem(itemSchema: Schema.Top, path: string): Field {
  return {
    name: "item",
    id: readFieldId(itemSchema, path),
    arrowType: mapEffectTypeToArrow(itemSchema, path),
    nullable: readNullable(itemSchema),
    metadata: readFieldMetadata(itemSchema),
  };
}

/**
 * Reads the FieldId annotation and normalizes it to bigint.
 */
function readFieldId(schema: Schema.Top, path: string): bigint {
  const annotations = getAnnotations(schema);
  const value = annotations[FieldId];
  if (value === undefined) {
    throw new Error(`Missing FieldId annotation for "${path}".`);
  }
  if (typeof value === "bigint") {
    return value;
  }
  if (typeof value === "number" && Number.isInteger(value)) {
    return BigInt(value);
  }
  throw new Error(`Invalid FieldId annotation for "${path}".`);
}

/**
 * Reads the internal Arrow type annotation from a schema.
 */
function readWingsTypeAnnotation(schema: Schema.Top): WingsTypeAnnotation | undefined {
  const annotations = getAnnotations(schema);
  return annotations[WingsType] as WingsTypeAnnotation | undefined;
}

/**
 * Reads field-level metadata annotations.
 */
function readFieldMetadata(schema: Schema.Top): Readonly<Record<string, string>> {
  const annotations = getAnnotations(schema);
  const metadata = annotations[FieldMetadata] as Readonly<Record<string, string>> | undefined;
  return metadata ?? {};
}

/**
 * Reads schema-level metadata annotations.
 */
function readSchemaMetadata(schema: Schema.Top): Readonly<Record<string, string>> {
  const annotations = getAnnotations(schema);
  const metadata = annotations[SchemaMetadata] as Readonly<Record<string, string>> | undefined;
  return metadata ?? {};
}

/**
 * Reads whether a schema should be marked nullable for Wings Arrow.
 */
function readNullable(schema: Schema.Top): boolean {
  const annotations = getAnnotations(schema);
  return annotations[WingsNullable] === true;
}

/**
 * Returns the annotation map from a schema AST.
 */
function getAnnotations(schema: Schema.Top): Record<PropertyKey, unknown> {
  return (SchemaAST.resolve(schema.ast) ?? {}) as Record<PropertyKey, unknown>;
}

/**
 * Runtime check for struct schemas that expose a fields map.
 */
function isStructSchema(schema: Schema.Top): schema is Schema.Struct<Schema.Struct.Fields> {
  return (
    (typeof schema === "object" || typeof schema === "function") &&
    schema !== null &&
    "fields" in schema &&
    typeof schema.fields === "object"
  );
}

/**
 * Maps a primitive annotation to its Wings Arrow type tag.
 */
function primitiveArrowType(type: PrimitiveArrowTypeTag): ArrowType {
  switch (type) {
    case "bool":
      return { _tag: "bool" };
    case "uint8":
      return { _tag: "uint8" };
    case "int8":
      return { _tag: "int8" };
    case "uint16":
      return { _tag: "uint16" };
    case "int16":
      return { _tag: "int16" };
    case "uint32":
      return { _tag: "uint32" };
    case "int32":
      return { _tag: "int32" };
    case "uint64":
      return { _tag: "uint64" };
    case "int64":
      return { _tag: "int64" };
    case "float16":
      return { _tag: "float16" };
    case "float32":
      return { _tag: "float32" };
    case "float64":
      return { _tag: "float64" };
    case "utf8":
      return { _tag: "utf8" };
    case "binary":
      return { _tag: "binary" };
    case "date32":
      return { _tag: "date32" };
    case "date64":
      return { _tag: "date64" };
  }
}
