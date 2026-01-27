import * as fs from "node:fs";
import type { FieldConfig } from "@airfoil/wings";
import { WingsClusterMetadata } from "@airfoil/wings";
import * as p from "@clack/prompts";
import { Command, Options } from "@effect/cli";
import { printTable } from "console-table-printer";
import { Effect, Option } from "effect";
import { makeClusterMetadataLayer } from "../../../utils/client.js";
import { handleCliError } from "../../../utils/effect.js";
import { hostOption, portOption } from "../../../utils/options.js";

// Supported simple types (no config required)
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
  "LargeUtf8",
  "LargeBinary",
  "DateDay",
  "DateMillisecond",
  "TimeSecond",
  "TimeMillisecond",
  "TimeMicrosecond",
  "TimeNanosecond",
  "TimestampSecond",
  "TimestampMillisecond",
  "TimestampMicrosecond",
  "TimestampNanosecond",
  "DurationSecond",
  "DurationMillisecond",
  "DurationMicrosecond",
  "DurationNanosecond",
  "IntervalDayTime",
  "IntervalYearMonth",
  "IntervalMonthDayNano",
] as const;

type SupportedInlineType = (typeof SUPPORTED_INLINE_TYPES)[number];

const parentOption = Options.text("parent").pipe(
  Options.withDescription(
    "Parent namespace in format: tenants/{tenant}/namespaces/{namespace}",
  ),
);

const topicIdOption = Options.text("topic-id").pipe(
  Options.withDescription("Unique identifier for the topic"),
);

const descriptionOption = Options.text("description").pipe(
  Options.withDescription("Topic description"),
  Options.optional,
);

const fieldsOption = Options.text("fields").pipe(
  Options.withDescription(
    'Field definitions in format "name:Type" or "name:Type?" for nullable',
  ),
  Options.repeated,
);

const schemaFileOption = Options.text("schema-file").pipe(
  Options.withDescription(
    "Path to JSON file containing FieldConfig[] (for complex types)",
  ),
  Options.optional,
);

const partitionKeyOption = Options.text("partition-key").pipe(
  Options.withDescription("Name of the field used for partitioning"),
  Options.optional,
);

const freshnessSecondsOption = Options.integer("freshness-seconds").pipe(
  Options.withDescription("How often to compact the topic (seconds)"),
  Options.withDefault(60),
);

const ttlSecondsOption = Options.integer("ttl-seconds").pipe(
  Options.withDescription("How long to keep topic data (seconds)"),
  Options.optional,
);

/**
 * Parse a field string in format "name:Type" or "name:Type?" (nullable)
 */
function parseFieldString(fieldStr: string): FieldConfig {
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
  } as FieldConfig;
}

/**
 * Parse multiple field strings into FieldConfig array
 */
function parseFieldsFromArgs(fields: string[]): FieldConfig[] {
  return fields.map(parseFieldString);
}

/**
 * Load fields from a JSON schema file with basic validation
 */
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
    throw new Error(
      `Schema file must contain an array of fields. Got: ${typeof parsed}`,
    );
  }

  if (parsed.length === 0) {
    throw new Error(
      "Schema file contains an empty array. At least one field is required.",
    );
  }

  return parsed as FieldConfig[];
}

export const createTopicCommand = Command.make(
  "create-topic",
  {
    parent: parentOption,
    topicId: topicIdOption,
    description: descriptionOption,
    fields: fieldsOption,
    schemaFile: schemaFileOption,
    partitionKey: partitionKeyOption,
    freshnessSeconds: freshnessSecondsOption,
    ttlSeconds: ttlSecondsOption,
    host: hostOption,
    port: portOption,
  },
  ({
    parent,
    topicId,
    description,
    fields,
    schemaFile,
    partitionKey,
    freshnessSeconds,
    ttlSeconds,
    host,
    port,
  }) =>
    Effect.gen(function* () {
      p.intro("📋 Create Topic");

      const schemaFilePath = Option.getOrUndefined(schemaFile);
      const hasFields = fields.length > 0;

      if (!hasFields && !schemaFilePath) {
        return yield* Effect.fail(
          new Error("Either --fields or --schema-file must be provided"),
        );
      }

      if (hasFields && schemaFilePath) {
        return yield* Effect.fail(
          new Error("Cannot use both --fields and --schema-file. Choose one."),
        );
      }

      const topicFields = yield* Effect.try({
        try: () =>
          schemaFilePath
            ? loadFieldsFromFile(schemaFilePath)
            : parseFieldsFromArgs(fields),
        catch: (error) =>
          error instanceof Error ? error : new Error("Failed to parse fields"),
      });

      if (topicFields.length === 0) {
        return yield* Effect.fail(new Error("At least one field is required"));
      }

      const partitionKeyName = Option.getOrUndefined(partitionKey);
      let partitionKeyIndex: number | undefined;
      if (partitionKeyName) {
        const index = topicFields.findIndex(
          (field) => field.name === partitionKeyName,
        );
        if (index === -1) {
          return yield* Effect.fail(
            new Error(
              `Partition key field "${partitionKeyName}" not found in fields. Available fields: ${topicFields.map((field) => field.name).join(", ")}`,
            ),
          );
        }
        partitionKeyIndex = index;
      }

      const layer = makeClusterMetadataLayer(host, port);

      const s = p.spinner();
      s.start("Creating topic...");

      const topic = yield* WingsClusterMetadata.createTopic({
        parent,
        topicId,
        description: Option.getOrUndefined(description),
        fields: topicFields,
        partitionKey: partitionKeyIndex,
        compaction: {
          freshnessSeconds: BigInt(freshnessSeconds),
          ttlSeconds: Option.getOrUndefined(
            Option.map(ttlSeconds, (ttl) => BigInt(ttl)),
          ),
        },
      }).pipe(
        Effect.provide(layer),
        Effect.tapError(() =>
          Effect.sync(() => s.stop("Failed to create topic")),
        ),
      );

      s.stop("Topic created successfully");

      yield* Effect.sync(() => {
        printTable([
          {
            name: topic.name,
            description: topic.description || "-",
            partition_key:
              topic.partitionKey !== undefined
                ? topicFields[topic.partitionKey]?.name ||
                  topic.partitionKey.toString()
                : "-",
            freshness_seconds: topic.compaction.freshnessSeconds.toString(),
            ttl_seconds: topic.compaction.ttlSeconds?.toString() || "-",
            fields_count: topic.fields.length.toString(),
          },
        ]);

        if (topic.fields.length > 0) {
          console.log("\nFields:");
          printTable(
            topic.fields.map(
              (
                field: { name: string; dataType: string; nullable: boolean },
                index: number,
              ) => ({
                index: index.toString(),
                name: field.name,
                type: field.dataType,
                nullable: field.nullable ? "yes" : "no",
              }),
            ),
          );
        }

        p.outro("✓ Done");
      });
    }).pipe(Effect.catchAll(handleCliError("Failed to create topic"))),
).pipe(Command.withDescription("Create a new topic belonging to a namespace"));
