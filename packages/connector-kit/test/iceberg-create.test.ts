import type { CommitTableRequest, StructField, TableMetadata, TableSchema } from "iceberg-js";

import { describe, expect, it } from "@effect/vitest";
import { Effect, Ref, Schema } from "effect";

import { ensureTable } from "../src/catalog/table";
import * as Iceberg from "../src/iceberg";

const Row = Schema.Struct({
  id: Schema.String.pipe(Iceberg.field(1)),
  details: Schema.Struct({
    value: Schema.String.pipe(Iceberg.field(101)),
  }).pipe(Iceberg.field(2)),
});

const identifier = { namespace: ["default"], name: "rows" };
const location = "s3://warehouse/default/rows";

const metadata = (schema: TableSchema): TableMetadata => ({
  "format-version": 2,
  "table-uuid": "test",
  schemas: [{ ...schema, "schema-id": 0 }],
  "current-schema-id": 0,
  "partition-specs": [],
  "sort-orders": [],
  properties: {},
});

const schemaFrom = (request: CommitTableRequest): TableSchema => {
  const update = request.updates.find((item) => item.action === "add-schema");
  if (update?.action !== "add-schema") throw new Error("Missing schema update");
  return update.schema;
};

describe("Iceberg table creation", () => {
  it.effect("shows the schema path when a field ID is missing", () =>
    Effect.gen(function* () {
      const invalid = Schema.Struct({ id: Schema.String });
      const catalog = {
        loadTable: () => Effect.die("Unexpected load"),
      } as unknown as Parameters<typeof ensureTable>[1]["catalog"];

      const error = yield* ensureTable(invalid, { catalog, identifier }).pipe(Effect.flip);
      expect(error.message).toContain("$.id: Missing fieldId");
    }),
  );

  it.effect("creates a missing table and reuses it on the next startup", () =>
    Effect.gen(function* () {
      const stored = yield* Ref.make<TableMetadata | undefined>(undefined);
      const commits = yield* Ref.make(0);
      const catalog = {
        loadTable: () =>
          Ref.get(stored).pipe(
            Effect.flatMap((value) =>
              value
                ? Effect.succeed(value)
                : Effect.fail({ status: 404, message: "Table not found" }),
            ),
          ),
        commitTable: (_identifier: typeof identifier, request: CommitTableRequest) =>
          Ref.set(stored, metadata(schemaFrom(request))).pipe(
            Effect.andThen(Ref.update(commits, (count) => count + 1)),
          ),
      } as unknown as Parameters<typeof ensureTable>[1]["catalog"];

      yield* ensureTable(Row, { catalog, identifier });
      yield* ensureTable(Row, { catalog, identifier });

      expect(yield* Ref.get(commits)).toBe(1);
    }),
  );

  it.effect("rejects a mismatched existing table before writing", () =>
    Effect.gen(function* () {
      const request = yield* Iceberg.makeCreateTableCommitRequest(Row, { location });
      const schema = schemaFrom(request);
      const changed = (name: string, changes: Partial<StructField>) =>
        metadata({
          ...schema,
          fields: schema.fields.map((field) =>
            field.name === name ? { ...field, ...changes } : field,
          ),
        });
      const cases = [
        [changed("id", { id: 9 }), "$.id"],
        [changed("id", { type: "double" }), "$.id"],
        [
          changed("details", {
            type: { type: "list", "element-id": 101, element: "string", "element-required": true },
          }),
          "$.details",
        ],
      ] as const;

      for (const [actual, path] of cases) {
        const catalog = {
          loadTable: () => Effect.succeed(actual),
          commitTable: () => Effect.die("Unexpected commit"),
        } as unknown as Parameters<typeof ensureTable>[1]["catalog"];

        const error = yield* ensureTable(Row, { catalog, identifier, location }).pipe(Effect.flip);
        expect(error.message).toContain(path);
        expect(error.message).toContain("Migrate the table or revert the schema change.");
      }
    }),
  );

  it.effect("loads a table created by another instance", () =>
    Effect.gen(function* () {
      const request = yield* Iceberg.makeCreateTableCommitRequest(Row, { location });
      const created = metadata(schemaFrom(request));
      const loads = yield* Ref.make(0);
      const catalog = {
        loadTable: () =>
          Ref.getAndUpdate(loads, (count) => count + 1).pipe(
            Effect.flatMap((count) =>
              count === 0
                ? Effect.fail({ status: 404, message: "Table not found" })
                : Effect.succeed(created),
            ),
          ),
        commitTable: () => Effect.fail({ status: 409, message: "Table already exists" }),
      } as unknown as Parameters<typeof ensureTable>[1]["catalog"];

      yield* ensureTable(Row, { catalog, identifier, location });
      expect(yield* Ref.get(loads)).toBe(2);
    }),
  );
});
