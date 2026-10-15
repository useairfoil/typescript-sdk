import { describe, expect, it } from "@effect/vitest";
import { Iceberg } from "@useairfoil/connector-kit";
import { Effect } from "effect";

import { objects } from "../src/manifest";
import { tableSchemas } from "../src/tables";

type CommitRequest = Effect.Success<ReturnType<typeof Iceberg.makeCreateTableCommitRequest>>;
type AddSchema = Extract<CommitRequest["updates"][number], { readonly action: "add-schema" }>;
type TableSchema = AddSchema["schema"];
type IcebergType = TableSchema["fields"][number]["type"];

const tableSchema = (request: CommitRequest): TableSchema => {
  const update = request.updates.find((item) => item.action === "add-schema");
  if (update?.action !== "add-schema") throw new Error("Missing add-schema update");
  return update.schema;
};

const undocumented = (type: IcebergType): ReadonlyArray<string> => {
  if (typeof type === "string") return [];
  switch (type.type) {
    case "struct":
      return type.fields.flatMap((field) => [
        ...(field.doc ? [] : [field.name]),
        ...undocumented(field.type),
      ]);
    case "list":
      return undocumented(type.element);
    case "map":
      return [...undocumented(type.key), ...undocumented(type.value)];
  }
};

const describeType = (type: IcebergType): string => {
  if (typeof type === "string") return type;
  switch (type.type) {
    case "struct":
      return `struct<${type.fields.map((field) => `${field.id} ${field.name}${field.required ? "" : "?"}: ${describeType(field.type)}`).join(", ")}>`;
    case "list":
      return `list<${type["element-id"]}: ${describeType(type.element)}>`;
    case "map":
      return `map<${type["key-id"]}: ${describeType(type.key)}, ${type["value-id"]}: ${describeType(type.value)}>`;
  }
};

describe("Iceberg schemas", () => {
  it.effect("compiles every table with documented, stable field IDs", () =>
    Effect.gen(function* () {
      const missingDocs: Array<string> = [];
      const tables: Record<string, ReadonlyArray<string>> = {};
      for (const [name, schema] of Object.entries(tableSchemas)) {
        const fields = tableSchema(
          yield* Iceberg.makeCreateTableCommitRequest(schema, {
            location: `s3://warehouse/salesforce-${name}`,
          }),
        );
        missingDocs.push(...undocumented(fields).map((field) => `${name}.${field}`));
        tables[name] = [
          `identifier: ${fields["identifier-field-ids"]?.join(", ")}`,
          ...fields.fields.map(
            (field) =>
              `${field.id} ${field.name}${field.required ? "" : "?"}: ${describeType(field.type)}`,
          ),
        ];
      }

      // Every standard object table has the same fields.
      const differing = objects
        .map((spec) => spec.name)
        .filter((name) => JSON.stringify(tables[name]) !== JSON.stringify(tables.accounts));

      expect({
        tables: Object.keys(tables).length,
        missingDocs,
        differing,
        accounts: tables.accounts,
        custom_objects: tables.custom_objects,
        object_fields: tables.object_fields,
      }).toMatchInlineSnapshot(`
        {
          "accounts": [
            "identifier: 1",
            "1 id: string",
            "2 version?: timestamptz",
            "3 created_at?: timestamptz",
            "4 updated_at?: timestamptz",
            "5 fields?: map<101: string, 102: string>",
            "6 _deleted?: boolean",
          ],
          "custom_objects": [
            "identifier: 1",
            "1 id: string",
            "2 version?: timestamptz",
            "3 created_at?: timestamptz",
            "4 updated_at?: timestamptz",
            "5 fields?: map<101: string, 102: string>",
            "6 _deleted?: boolean",
            "7 object?: string",
          ],
          "differing": [],
          "missingDocs": [],
          "object_fields": [
            "identifier: 1",
            "1 id: string",
            "2 version?: timestamptz",
            "3 object?: string",
            "4 name?: string",
            "5 label?: string",
            "6 type?: string",
            "7 custom?: boolean",
            "8 calculated?: boolean",
            "9 nillable?: boolean",
            "10 length?: long",
            "11 precision?: long",
            "12 scale?: long",
            "13 reference_to?: list<101: string>",
            "14 picklist_values?: list<102: struct<103 value: string, 104 label?: string, 105 active: boolean>>",
          ],
          "tables": 89,
        }
      `);
    }),
  );
});
