import * as Wings from "@useairfoil/wings";
import { Config, Effect, Schema } from "effect";

import type { ConnectorDefinition, ResourceName } from "../core/types";

import { PlatformRuntimeKey } from "./constants";
import { RuntimeConfigError } from "./error";

/** Table binding shape accepted in `AIRFOIL_TABLE_BINDINGS`. */
export type HostedTableBinding =
  | string
  | {
      readonly name: string;
      readonly partition?: Wings.PartitionValue.Json;
    };

/** Validated table binding ready for the Wings publisher. */
export type ResolvedTableBinding = {
  readonly name: string;
  readonly partitionValue?: Wings.PartitionValue.PartitionValue;
};

/** One resolved binding for each resource in a connector manifest. */
export type ResolvedTableBindings<Connector extends ConnectorDefinition> = Readonly<
  Record<ResourceName<Connector["resources"]>, ResolvedTableBinding>
>;

const RawBindingsSchema = Schema.fromJsonString(Schema.Record(Schema.String, Schema.Unknown));

// JSON.parse keeps the last duplicate key, so check before decoding.
const duplicateTopLevelKey = (json: string): string | undefined => {
  const keys = new Set<string>();
  let depth = 0;
  let expectKey = false;
  for (let index = 0; index < json.length; index += 1) {
    const char = json[index];
    if (char === '"') {
      const start = index;
      for (index += 1; index < json.length; index += 1) {
        if (json[index] === "\\") {
          index += 1;
        } else if (json[index] === '"') {
          break;
        }
      }
      if (depth === 1 && expectKey) {
        const key = JSON.parse(json.slice(start, index + 1)) as string;
        if (keys.has(key)) return key;
        keys.add(key);
        expectKey = false;
      }
      continue;
    }
    if (char === "{") {
      depth += 1;
      if (depth === 1) expectKey = true;
    } else if (char === "}") {
      depth -= 1;
    } else if (char === "," && depth === 1) {
      expectKey = true;
    }
  }
  return undefined;
};

const asError = (cause: unknown): Error =>
  cause instanceof Error ? cause : new Error(String(cause));

const fail = (code: "TABLE_BINDINGS_INVALID" | "TABLE_BINDINGS_MISMATCH", message: string) =>
  new RuntimeConfigError({ code, message, cause: new Error(message) });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasExactKeys = (value: Record<string, unknown>, allowed: ReadonlyArray<string>) => {
  const keys = Object.keys(value);
  return (
    keys.length === allowed.filter((key) => key in value).length &&
    keys.every((key) => allowed.includes(key))
  );
};

const nonEmptyName = (value: unknown): string => {
  if (typeof value !== "string" || value.length === 0 || value.trim() !== value) {
    throw fail("TABLE_BINDINGS_INVALID", "Table binding names must be non-empty strings");
  }
  return value;
};

const resolveBinding = (input: unknown): Effect.Effect<ResolvedTableBinding, RuntimeConfigError> =>
  Effect.gen(function* () {
    const binding = yield* Effect.try({
      try: () => {
        if (typeof input === "string") return { name: nonEmptyName(input) } as const;
        if (!isRecord(input) || !hasExactKeys(input, ["name", "partition"])) {
          throw fail(
            "TABLE_BINDINGS_INVALID",
            "Table bindings must be a name string or an object containing name and optional partition",
          );
        }
        return { name: nonEmptyName(input.name), partition: input.partition } as const;
      },
      catch: (cause) =>
        cause instanceof RuntimeConfigError
          ? cause
          : fail("TABLE_BINDINGS_INVALID", "Hosted table binding is invalid"),
    });
    if (!("partition" in binding) || binding.partition === undefined) {
      return { name: binding.name };
    }
    const partitionValue = yield* Wings.PartitionValue.decodeJson(binding.partition).pipe(
      Effect.mapError(
        (cause) =>
          new RuntimeConfigError({
            code: "TABLE_BINDINGS_INVALID",
            message: "Hosted table binding has an invalid partition value",
            cause,
          }),
      ),
    );
    return { name: binding.name, partitionValue };
  });

/** Loads and validates the complete hosted Wings table map for a connector. */
export const loadTableBindings = <const Connector extends ConnectorDefinition>(
  connector: Connector,
): Effect.Effect<ResolvedTableBindings<Connector>, RuntimeConfigError> =>
  Effect.gen(function* () {
    const raw = yield* Config.nonEmptyString(PlatformRuntimeKey.tableBindings).pipe(
      Effect.mapError(
        (cause) =>
          new RuntimeConfigError({
            code: "TABLE_BINDINGS_MISSING",
            message: `${PlatformRuntimeKey.tableBindings} is required in hosted mode`,
            cause: asError(cause),
          }),
      ),
    );
    const duplicate = yield* Effect.try({
      try: () => duplicateTopLevelKey(raw),
      catch: (cause) =>
        new RuntimeConfigError({
          code: "TABLE_BINDINGS_INVALID",
          message: "Hosted table bindings are not valid JSON",
          cause: asError(cause),
        }),
    });
    if (duplicate !== undefined) {
      return yield* Effect.fail(
        fail("TABLE_BINDINGS_INVALID", "Hosted table bindings contain a duplicate resource"),
      );
    }
    const decoded = yield* Schema.decodeUnknownEffect(RawBindingsSchema)(raw).pipe(
      Effect.mapError(
        (cause) =>
          new RuntimeConfigError({
            code: "TABLE_BINDINGS_INVALID",
            message: "Hosted table bindings are not valid JSON",
            cause: asError(cause),
          }),
      ),
    );
    // Starting with a partial map would leave some manifest resources unwired.
    const expected = new Set(connector.resources.map((resource) => resource.name));
    const actual = Object.keys(decoded);
    const missing = [...expected].filter((name) => !(name in decoded));
    const unknown = actual.filter((name) => !expected.has(name));
    if (missing.length > 0 || unknown.length > 0) {
      return yield* Effect.fail(
        fail(
          "TABLE_BINDINGS_MISMATCH",
          `Hosted table bindings do not match connector resources (missing: ${missing.join(", ") || "none"}; unknown resources: ${unknown.length})`,
        ),
      );
    }
    const entries = yield* Effect.forEach(actual, (name) =>
      resolveBinding(decoded[name]).pipe(Effect.map((binding) => [name, binding] as const)),
    );
    return Object.fromEntries(entries) as ResolvedTableBindings<Connector>;
  });
