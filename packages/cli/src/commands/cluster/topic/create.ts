import * as fs from "node:fs";
import type { FieldConfig } from "@airfoil/wings";
import * as p from "@clack/prompts";
import { Command } from "commander";
import { printTable } from "console-table-printer";
import { createClusterMetadataClient } from "../../../utils/client";
import {
  hostOption,
  portOption,
  type ServerOptions,
} from "../../../utils/options";

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

type CreateTopicOptions = ServerOptions & {
  parent: string;
  topicId: string;
  description?: string;
  fields?: string[];
  schemaFile?: string;
  partitionKey?: string;
  freshnessSeconds: string;
  ttlSeconds?: string;
};

export const createTopicCommand = new Command("create-topic")
  .description("Create a new topic belonging to a namespace")
  .requiredOption(
    "--parent <parent>",
    "Parent namespace in format: tenants/{tenant}/namespaces/{namespace}",
  )
  .requiredOption("--topic-id <id>", "Unique identifier for the topic")
  .option("--description <description>", "Topic description")
  .option(
    "--fields <fields...>",
    'Field definitions in format "name:Type" or "name:Type?" for nullable',
  )
  .option(
    "--schema-file <path>",
    "Path to JSON file containing FieldConfig[] (for complex types)",
  )
  .option("--partition-key <name>", "Name of the field used for partitioning")
  .option(
    "--freshness-seconds <seconds>",
    "How often to compact the topic (seconds)",
    "60",
  )
  .option("--ttl-seconds <seconds>", "How long to keep topic data (seconds)")
  .addOption(hostOption)
  .addOption(portOption)
  .addHelpText(
    "after",
    `
Supported Types for --fields:
  Integers:    Int8, Int16, Int32, Int64, Uint8, Uint16, Uint32, Uint64
  Floats:      Float16, Float32, Float64
  Boolean:     Bool, Null
  Strings:     Utf8, LargeUtf8, Binary, LargeBinary
  Date:        DateDay, DateMillisecond
  Time:        TimeSecond, TimeMillisecond, TimeMicrosecond, TimeNanosecond
  Timestamp:   TimestampSecond, TimestampMillisecond, TimestampMicrosecond, TimestampNanosecond
  Duration:    DurationSecond, DurationMillisecond, DurationMicrosecond, DurationNanosecond
  Interval:    IntervalDayTime, IntervalYearMonth, IntervalMonthDayNano

For complex types (List, Struct, Map, etc.), use --schema-file with a JSON file.
`,
  )
  .action(async (options: CreateTopicOptions) => {
    try {
      p.intro("📋 Create Topic");

      if (!options.fields && !options.schemaFile) {
        throw new Error("Either --fields or --schema-file must be provided");
      }
      if (options.fields && options.schemaFile) {
        throw new Error(
          "Cannot use both --fields and --schema-file. Choose one.",
        );
      }

      let fields: FieldConfig[];
      if (options.schemaFile) {
        fields = loadFieldsFromFile(options.schemaFile);
      } else {
        fields = parseFieldsFromArgs(options.fields as string[]);
      }

      if (fields.length === 0) {
        throw new Error("At least one field is required");
      }

      let partitionKey: number | undefined;
      if (options.partitionKey) {
        const index = fields.findIndex((f) => f.name === options.partitionKey);
        if (index === -1) {
          throw new Error(
            `Partition key field "${options.partitionKey}" not found in fields. Available fields: ${fields.map((f) => f.name).join(", ")}`,
          );
        }
        partitionKey = index;
      }

      const client = createClusterMetadataClient(options.host, options.port);

      const s = p.spinner();
      s.start("Creating topic...");

      const topic = await client.createTopic({
        parent: options.parent,
        topicId: options.topicId,
        description: options.description,
        fields,
        partitionKey,
        compaction: {
          freshnessSeconds: BigInt(options.freshnessSeconds),
          ttlSeconds: options.ttlSeconds
            ? BigInt(options.ttlSeconds)
            : undefined,
        },
      });

      s.stop("Topic created successfully");

      printTable([
        {
          name: topic.name,
          description: topic.description || "-",
          partition_key:
            topic.partitionKey !== undefined
              ? fields[topic.partitionKey]?.name ||
                topic.partitionKey.toString()
              : "-",
          freshness_seconds:
            topic.compaction?.freshnessSeconds.toString() || "-",
          ttl_seconds: topic.compaction?.ttlSeconds?.toString() || "-",
          fields_count: topic.fields.length.toString(),
        },
      ]);

      if (topic.fields.length > 0) {
        console.log("\nFields:");
        printTable(
          topic.fields.map((field, idx) => ({
            index: idx.toString(),
            name: field.name,
            type: field.dataType,
            nullable: field.nullable ? "yes" : "no",
          })),
        );
      }

      p.outro("✓ Done");
    } catch (error) {
      p.cancel(
        error instanceof Error ? error.message : "Failed to create topic",
      );
      process.exit(1);
    }
  });
