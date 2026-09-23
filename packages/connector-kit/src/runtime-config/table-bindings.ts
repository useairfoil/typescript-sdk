import type { TableIdentifier } from "iceberg-js";

import { Config, Effect, Schema } from "effect";

import type { ConnectorDefinition, ResourceName } from "../core/types";

import { PlatformRuntimeKey } from "./constants";
import { RuntimeConfigError } from "./error";

/** An Iceberg table and its storage location for each connector resource. */
export type TableBinding = TableIdentifier & { readonly location?: string | undefined };

export type ResolvedTableBindings<Connector extends ConnectorDefinition> = Readonly<
  Record<ResourceName<Connector["resources"]>, TableBinding>
>;

const TableIdentifierSchema = Schema.Struct({
  namespace: Schema.NonEmptyArray(Schema.NonEmptyString),
  name: Schema.NonEmptyString,
  location: Schema.optional(Schema.NonEmptyString),
});

const RawBindingsSchema = Schema.fromJsonString(
  Schema.Record(Schema.String, TableIdentifierSchema),
);

const asError = (cause: unknown): Error =>
  cause instanceof Error ? cause : new Error(String(cause));

const fail = (code: "TABLE_BINDINGS_INVALID" | "TABLE_BINDINGS_MISMATCH", message: string) =>
  new RuntimeConfigError({ code, message, cause: new Error(message) });

/** Reads hosted table bindings and checks they match the connector. */
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

    const decoded = yield* Schema.decodeUnknownEffect(RawBindingsSchema)(raw, {
      onExcessProperty: "error",
    }).pipe(
      Effect.mapError(
        (cause) =>
          new RuntimeConfigError({
            code: "TABLE_BINDINGS_INVALID",
            message: "Hosted table bindings are invalid",
            cause: asError(cause),
          }),
      ),
    );

    // Bindings come from the platform, resources from the connector. If they disagree,
    // one of them is out of date and we could write to the wrong table.
    const expected = new Set(connector.resources.map((resource) => resource.name));
    const actual = Object.keys(decoded);
    const missing = [...expected].filter((name) => !Object.hasOwn(decoded, name));
    const unknown = actual.filter((name) => !expected.has(name));

    if (missing.length > 0 || unknown.length > 0) {
      return yield* Effect.fail(
        fail(
          "TABLE_BINDINGS_MISMATCH",
          `Hosted table bindings do not match connector resources (missing: ${missing.join(", ") || "none"}; unknown resources: ${unknown.length})`,
        ),
      );
    }

    return Object.fromEntries(
      Object.entries(decoded).map(([resource, identifier]) => [
        resource,
        {
          namespace: Array.from(identifier.namespace),
          name: identifier.name,
          ...(identifier.location === undefined ? {} : { location: identifier.location }),
        },
      ]),
    ) as ResolvedTableBindings<Connector>;
  });
