import * as p from "@clack/prompts";
import { Arrow, ClusterClient } from "@useairfoil/wings";
import { printTable } from "console-table-printer";
import { Effect, Option } from "effect";
import { Command, Flag } from "effect/unstable/cli";
import * as fs from "node:fs";

import { makeClusterClientLayer } from "../../../utils/client";
import { hostOption, portOption } from "../../../utils/options";

const SUPPORTED_INLINE_TYPES = [
  "Int8",
  "Int16",
  "Int32",
  "Int64",
  "Uint8",
  "Uint16",
  "Uint32",
  "Uint64",
  "Bool",
  "Utf8",
  "Binary",
  "Null",
  "Float16",
  "Float32",
  "Float64",
  "DateDay",
  "DateMillisecond",
  "TimestampSecond",
  "TimestampMillisecond",
  "TimestampMicrosecond",
  "TimestampNanosecond",
  "DurationSecond",
  "DurationMillisecond",
  "DurationMicrosecond",
  "DurationNanosecond",
] as const;

type SupportedInlineType = (typeof SUPPORTED_INLINE_TYPES)[number];
type FieldConfig = Arrow.FieldConfig;

const parentOption = Flag.string("parent").pipe(
  Flag.withDescription("Parent namespace in format: namespaces/{namespace}"),
);

const tableIdOption = Flag.string("table-id").pipe(
  Flag.withDescription("Unique identifier for the table"),
);

const descriptionOption = Flag.string("description").pipe(
  Flag.withDescription("Table description"),
  Flag.optional,
);

const fieldsOption = Flag.string("fields").pipe(
  Flag.withDescription('Field definitions in format "name:Type" or "name:Type?" for nullable'),
  Flag.atLeast(0),
);

const schemaFileOption = Flag.string("schema-file").pipe(
  Flag.withDescription("Path to JSON file containing FieldConfig[] (for complex types)"),
  Flag.optional,
);

const keyFieldOption = Flag.string("key-field").pipe(
  Flag.withDescription("Name of the field used as the primary key"),
);

const versionFieldOption = Flag.string("version-field").pipe(
  Flag.withDescription("Name of the field used as the version/timestamp"),
);

const partitionFieldOption = Flag.string("partition-field").pipe(
  Flag.withDescription("Name of the field used for partitioning"),
  Flag.optional,
);

const freshnessSecondsOption = Flag.integer("freshness-seconds").pipe(
  Flag.withDescription("Target freshness interval for compaction (seconds)"),
  Flag.withDefault(60),
);

function parseFieldString(fieldStr: string, index: number): FieldConfig {
  const match = fieldStr.match(/^([^:]+):([^?]+)(\?)?$/);
  if (!match) {
    throw new Error(
      `Invalid field format: "${fieldStr}". Expected format: "name:Type" or "name:Type?"`,
    );
  }

  const name = match[1];
  const dataType = match[2];
  const nullableMarker = match[3];

  if (!name || !dataType) {
    throw new Error(
      `Invalid field format: "${fieldStr}". Expected format: "name:Type" or "name:Type?"`,
    );
  }

  const nullable = nullableMarker === "?";

  if (!SUPPORTED_INLINE_TYPES.includes(dataType as SupportedInlineType)) {
    throw new Error(
      `Unsupported type: "${dataType}". Supported types: ${SUPPORTED_INLINE_TYPES.join(", ")}. For complex types, use --schema-file.`,
    );
  }

  return {
    name: name.trim(),
    dataType: dataType as SupportedInlineType,
    nullable,
    id: BigInt(index + 1),
  };
}

function parseFieldsFromArgs(fields: ReadonlyArray<string>): FieldConfig[] {
  return fields.map((field, index) => parseFieldString(field, index));
}

function loadFieldsFromFile(filePath: string): FieldConfig[] {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Schema file not found: "${filePath}"`);
  }

  const content = fs.readFileSync(filePath, "utf-8");

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error(`Invalid JSON in schema file: "${filePath}"`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error(`Schema file must contain an array of fields. Got: ${typeof parsed}`);
  }

  if (parsed.length === 0) {
    throw new Error("Schema file contains an empty array. At least one field is required.");
  }

  return (parsed as FieldConfig[]).map((field, index) => {
    const fieldId = (field as { id?: bigint | number }).id;
    return {
      ...field,
      id: typeof fieldId === "bigint" ? fieldId : BigInt(fieldId ?? index + 1),
    };
  });
}

export const createTableCommand = Command.make(
  "create-table",
  {
    parent: parentOption,
    tableId: tableIdOption,
    description: descriptionOption,
    fields: fieldsOption,
    schemaFile: schemaFileOption,
    keyField: keyFieldOption,
    versionField: versionFieldOption,
    partitionField: partitionFieldOption,
    freshnessSeconds: freshnessSecondsOption,
    host: hostOption,
    port: portOption,
  },
  ({
    parent,
    tableId,
    description,
    fields,
    schemaFile,
    keyField,
    versionField,
    partitionField,
    freshnessSeconds,
  }) =>
    Effect.gen(function* () {
      p.intro("📋 Create Table");

      const schemaFilePath = Option.getOrUndefined(schemaFile);
      const hasFields = fields.length > 0;

      if (!hasFields && !schemaFilePath) {
        return yield* Effect.fail(new Error("Either --fields or --schema-file must be provided"));
      }

      if (hasFields && schemaFilePath) {
        return yield* Effect.fail(
          new Error("Cannot use both --fields and --schema-file. Choose one."),
        );
      }

      const tableFields = yield* Effect.try({
        try: () =>
          schemaFilePath ? loadFieldsFromFile(schemaFilePath) : parseFieldsFromArgs(fields),
        catch: (error) => (error instanceof Error ? error : new Error("Failed to parse fields")),
      });

      if (tableFields.length === 0) {
        return yield* Effect.fail(new Error("At least one field is required"));
      }

      const resolveField = (fieldName: string, role: string): bigint => {
        const field = tableFields.find((f) => f.name === fieldName);
        if (!field) {
          throw new Error(
            `${role} field "${fieldName}" not found. Available fields: ${tableFields.map((f) => f.name).join(", ")}`,
          );
        }
        return field.id;
      };

      const keyFieldId = yield* Effect.try({
        try: () => resolveField(keyField, "Key"),
        catch: (e) => (e instanceof Error ? e : new Error(String(e))),
      });

      const versionFieldId = yield* Effect.try({
        try: () => resolveField(versionField, "Version"),
        catch: (e) => (e instanceof Error ? e : new Error(String(e))),
      });

      const partitionFieldName = Option.getOrUndefined(partitionField);
      const partitionFieldId = partitionFieldName
        ? yield* Effect.try({
            try: () => resolveField(partitionFieldName, "Partition"),
            catch: (e) => (e instanceof Error ? e : new Error(String(e))),
          })
        : undefined;

      const s = p.spinner();
      s.start("Creating table...");

      const table = yield* ClusterClient.createTable({
        parent,
        tableId,
        description: Option.getOrUndefined(description),
        fields: tableFields,
        keyFieldId,
        versionFieldId,
        partitionFieldId,
        targetFreshnessSeconds: BigInt(freshnessSeconds),
      }).pipe(Effect.tapError(() => Effect.sync(() => s.stop("Failed to create table"))));

      s.stop("Table created successfully");

      yield* Effect.sync(() => {
        printTable([
          {
            name: table.name,
            description: table.description || "-",
            key_field_id: table.keyFieldId.toString(),
            version_field_id: table.versionFieldId.toString(),
            partition_field_id: table.partitionFieldId?.toString() || "-",
            freshness_seconds: table.targetFreshnessSeconds.toString(),
            fields_count: table.schema.fields.length.toString(),
          },
        ]);

        if (table.schema.fields.length > 0) {
          console.log("\nFields:");
          printTable(
            table.schema.fields.map((field) => ({
              name: field.name,
              id: field.id.toString(),
              type: field.arrowType?._tag ?? "unknown",
              nullable: field.nullable ? "yes" : "no",
            })),
          );
        }

        p.outro("✓ Done");
      });
    }),
).pipe(
  Command.withDescription("Create a new table belonging to a namespace"),
  Command.provide(({ host, port }) => makeClusterClientLayer(host, port)),
);
