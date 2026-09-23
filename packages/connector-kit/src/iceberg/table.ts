import type {
  CommitTableRequest,
  IcebergType,
  MapType,
  StructField,
  StructType,
  TableSchema,
} from "iceberg-js";

import { Effect, Schema, type SchemaRepresentation } from "effect";

import { IcebergSchemaError } from "./error";

/** Options for creating a table. */
export type CreateTableCommitOptions = {
  /** Where the table's files go, such as `s3://warehouse/rows`. */
  readonly location: string;
  /** UUID for the table. Random by default. */
  readonly uuid?: string | undefined;
  /** Extra table properties. These win over the ones from the schema. */
  readonly properties?: Readonly<Record<string, string>> | undefined;
};

type Representation = SchemaRepresentation.Representation;
type Resolved = Exclude<Representation, SchemaRepresentation.Reference>;
type Annotations = Schema.Annotations.Annotations;

type CompiledType = {
  readonly type: IcebergType;
  readonly nullable: boolean;
};

type CompiledTable = {
  readonly schema: TableSchema;
  readonly description: string | undefined;
};

// Iceberg reserves its highest 200 field IDs.
const maxFieldId = 2_147_483_447;

const anonymousDeclaration =
  "Schemas without a name, such as Schema.Class, do not work here; use Schema.Struct";

class CompilationFailure extends Error {
  readonly path: string;

  constructor(path: string, message: string) {
    super(message);
    this.path = path;
  }
}

const fail = (path: string, message: string): never => {
  throw new CompilationFailure(path, message);
};

const propertyPath = (path: string, name: string): string =>
  /^[A-Za-z_$][\w$]*$/.test(name) ? `${path}.${name}` : `${path}[${JSON.stringify(name)}]`;

/** Reads annotations the way Effect does: if there are checks, the last one wins. */
const resolveAnnotations = (representation: Resolved): Annotations | undefined => {
  const lastCheck = representation.checks.at(-1);
  return lastCheck === undefined ? representation.annotations : lastCheck.annotations;
};

const description = (annotations: Annotations | undefined): string | undefined => {
  const value = annotations?.description;
  return typeof value === "string" ? value : undefined;
};

const checkHasRepresentation = (
  checks: ReadonlyArray<SchemaRepresentation.Check>,
  id: string,
): boolean =>
  checks.some(
    (check) =>
      check.representation?.id === id ||
      (check._tag === "FilterGroup" && checkHasRepresentation(check.checks, id)),
  );

const isAnonymousDeclaration = (representation: Resolved): boolean =>
  representation._tag === "Declaration" && representation.representation?.id === undefined;

const literalType = (
  literal: SchemaRepresentation.Literal["literal"],
  path: string,
): IcebergType => {
  switch (typeof literal) {
    case "string":
      return "string";
    case "boolean":
      return "boolean";
    case "number":
      return Number.isFinite(literal)
        ? "double"
        : fail(path, "A number literal must be a real number, not Infinity or NaN");
    case "bigint":
      return "long";
    default:
      return fail(path, `A ${typeof literal} literal does not work here`);
  }
};

const assertNever = (_representation: never, path: string): never =>
  fail(path, "This kind of schema does not work here");

class Compiler {
  readonly #activeObjects = new Set<SchemaRepresentation.Objects>();
  readonly #activeReferences = new Set<string>();
  readonly #activeSuspends = new Set<SchemaRepresentation.Suspend>();
  readonly #fieldIds = new Map<number, string>();

  constructor(private readonly references: SchemaRepresentation.References) {}

  compile(root: Representation): CompiledTable {
    return this.#withReference(root, "$", (representation) => {
      if (isAnonymousDeclaration(representation)) return fail("$", anonymousDeclaration);
      if (representation._tag !== "Objects") {
        return fail("$", "The top level of a table must be a Schema.Struct");
      }

      return {
        schema: {
          type: "struct",
          fields: this.#compileFields(representation, "$"),
        },
        description: description(resolveAnnotations(representation)),
      };
    });
  }

  #readId(annotations: Annotations | undefined, path: string, source: string): number {
    const id = annotations?.fieldId;

    if (typeof id !== "number") {
      return fail(path, `Missing fieldId; add it with ${source}`);
    }
    if (!Number.isInteger(id)) return fail(path, "fieldId must be a whole number");
    if (id < 1 || id > maxFieldId) {
      return fail(path, `fieldId must be between 1 and ${maxFieldId}`);
    }
    const previousPath = this.#fieldIds.get(id);
    if (previousPath !== undefined) {
      return fail(path, `fieldId ${id} is already used at ${previousPath}`);
    }

    this.#fieldIds.set(id, path);
    return id;
  }

  #readNodeId(representation: Representation, path: string): number {
    return this.#withReference(representation, path, (resolved) =>
      this.#readId(
        resolveAnnotations(resolved),
        path,
        ".annotate({ fieldId }) on the schema itself",
      ),
    );
  }

  #withReference<A>(
    representation: Representation,
    path: string,
    compile: (resolved: Resolved) => A,
  ): A {
    if (representation._tag !== "Reference") return compile(representation);

    const reference = representation.$ref;
    const resolved = this.references[reference];
    if (resolved === undefined) return fail(path, `Cannot find the schema named ${reference}`);
    if (this.#activeReferences.has(reference)) {
      return fail(path, "Iceberg cannot store a schema that contains itself");
    }

    this.#activeReferences.add(reference);
    try {
      return this.#withReference(resolved, path, compile);
    } finally {
      this.#activeReferences.delete(reference);
    }
  }

  #checkRecursion(representation: Representation, path: string): void {
    if (representation._tag === "Reference" && this.#activeReferences.has(representation.$ref)) {
      fail(path, "Iceberg cannot store a schema that contains itself");
    }
  }

  #compileFields(representation: SchemaRepresentation.Objects, path: string): Array<StructField> {
    if (representation.indexSignatures.length > 0) {
      return fail(
        path,
        "Schema.Record does not work here; name the keys with Schema.Struct, or store it as a JSON string",
      );
    }

    return representation.propertySignatures.map((property) => {
      if (typeof property.name !== "string") {
        return fail(
          propertyPath(path, String(property.name)),
          "Iceberg field names must be strings",
        );
      }

      const fieldPath = propertyPath(path, property.name);
      this.#checkRecursion(property.type, fieldPath);
      const id = this.#readId(property.annotations, fieldPath, "Iceberg.field(id)");
      const compiled = this.#compileType(property.type, fieldPath);
      const fieldDescription = description(property.annotations);

      return {
        id,
        name: property.name,
        type: compiled.type,
        required: !property.isOptional && !compiled.nullable,
        ...(fieldDescription === undefined ? {} : { doc: fieldDescription }),
      };
    });
  }

  #compileType(representation: Representation, path: string): CompiledType {
    if (representation._tag === "Reference") {
      return this.#withReference(representation, path, (resolved) =>
        this.#compileType(resolved, path),
      );
    }

    switch (representation._tag) {
      case "String":
        return { type: "string", nullable: false };
      case "Boolean":
        return { type: "boolean", nullable: false };
      case "BigInt":
        return { type: "long", nullable: false };
      case "Number":
        // Schema.Int can exceed Iceberg int. A double holds every safe integer
        // exactly; a long would need bigint rows.
        return checkHasRepresentation(representation.checks, "effect/schema/isFinite") ||
          checkHasRepresentation(representation.checks, "effect/schema/isInt")
          ? { type: "double", nullable: false }
          : fail(path, "Plain Schema.Number does not work here; use Schema.Finite or Schema.Int");
      case "Literal":
        return { type: literalType(representation.literal, path), nullable: false };
      case "Objects": {
        if (this.#activeObjects.has(representation)) {
          return fail(path, "Iceberg cannot store a schema that contains itself");
        }

        this.#activeObjects.add(representation);
        try {
          return {
            type: {
              type: "struct",
              fields: this.#compileFields(representation, path),
            } satisfies StructType,
            nullable: false,
          };
        } finally {
          this.#activeObjects.delete(representation);
        }
      }
      case "Arrays":
        return this.#compileArray(representation, path);
      case "Declaration":
        return this.#compileDeclaration(representation, path);
      case "Union":
        return this.#compileUnion(representation, path);
      case "Suspend": {
        if (this.#activeSuspends.has(representation)) {
          return fail(path, "Iceberg cannot store a schema that contains itself");
        }

        this.#activeSuspends.add(representation);
        try {
          return this.#compileType(representation.thunk, path);
        } finally {
          this.#activeSuspends.delete(representation);
        }
      }
      case "Null":
      case "Undefined":
        return fail(path, "A field cannot contain only null or undefined");
      case "Any":
      case "Unknown":
      case "ObjectKeyword":
      case "Symbol":
      case "UniqueSymbol":
      case "Void":
      case "Never":
      case "Enum":
      case "TemplateLiteral":
        return fail(path, `A ${representation._tag} schema does not work here`);
      default:
        return assertNever(representation, path);
    }
  }

  #compileArray(representation: SchemaRepresentation.Arrays, path: string): CompiledType {
    if (representation.elements.length > 0 || representation.rest.length !== 1) {
      return fail(
        path,
        "A tuple does not work here; use a Schema.Array where every item has the same type",
      );
    }

    const elementPath = `${path}.element`;
    const elementRepresentation = representation.rest[0]!;
    const elementId = this.#readNodeId(elementRepresentation, elementPath);
    const compiled = this.#compileType(elementRepresentation, elementPath);

    return {
      type: {
        type: "list",
        "element-id": elementId,
        element: compiled.type,
        "element-required": !compiled.nullable,
      },
      nullable: false,
    };
  }

  #compileDeclaration(
    representation: SchemaRepresentation.Declaration,
    path: string,
  ): CompiledType {
    const id = representation.representation?.id;

    switch (id) {
      case "effect/schema/Date":
        return { type: "timestamptz", nullable: false };
      case "effect/schema/Uint8Array":
        return { type: "binary", nullable: false };
      case "effect/schema/ReadonlyMap":
        return this.#compileMap(representation, path);
      case undefined:
        return fail(path, anonymousDeclaration);
      default:
        return fail(path, `The ${id} schema does not work here`);
    }
  }

  #compileMap(representation: SchemaRepresentation.Declaration, path: string): CompiledType {
    if (representation.typeParameters.length !== 2) {
      return fail(path, "ReadonlyMap needs one key schema and one value schema");
    }

    const keyPath = `${path}.key`;
    const valuePath = `${path}.value`;
    const keyRepresentation = representation.typeParameters[0]!;
    const valueRepresentation = representation.typeParameters[1]!;
    const keyId = this.#readNodeId(keyRepresentation, keyPath);
    const compiledKey = this.#compileType(keyRepresentation, keyPath);

    if (compiledKey.nullable) return fail(keyPath, "Map keys cannot be null");

    const valueId = this.#readNodeId(valueRepresentation, valuePath);
    const compiledValue = this.#compileType(valueRepresentation, valuePath);

    return {
      type: {
        type: "map",
        "key-id": keyId,
        key: compiledKey.type,
        "value-id": valueId,
        value: compiledValue.type,
        "value-required": !compiledValue.nullable,
      } satisfies MapType,
      nullable: false,
    };
  }

  #compileUnion(representation: SchemaRepresentation.Union, path: string): CompiledType {
    let nullable = false;
    const concrete: Array<Representation> = [];

    for (const member of representation.types) {
      if (member._tag === "Null" || member._tag === "Undefined") {
        nullable = true;
      } else {
        concrete.push(member);
      }
    }

    if (concrete.length === 0) return fail(path, "A field cannot contain only null or undefined");

    if (concrete.length === 1) {
      const compiled = this.#compileType(concrete[0]!, path);
      return { type: compiled.type, nullable: nullable || compiled.nullable };
    }

    if (!concrete.every((member) => member._tag === "Literal")) {
      return fail(path, "A union only works when every member is a literal");
    }

    const first = literalType(concrete[0]!.literal, path);
    for (const member of concrete.slice(1)) {
      if (literalType(member.literal, path) !== first) {
        return fail(path, "Every literal in a union must be the same type");
      }
    }

    return { type: first, nullable };
  }
}

/**
 * Builds the commit that creates an Iceberg table from an Effect schema.
 *
 * The field IDs come from the schema, so the table has to keep them. Send the
 * commit with `commitTable`. Then load the table and check the IDs before you
 * write any rows. Don't use `createTable` here, because it can change the IDs.
 *
 * A root `description` becomes the table `comment`, and a field `description`
 * becomes its `doc`. `title` and `examples` are dropped.
 *
 * @example
 * ```ts
 * const Row = Schema.Struct({
 *   id: Schema.String.pipe(Iceberg.field(1, { description: "Stable row identifier" })),
 * }).annotate({ description: "Connector rows" })
 *
 * const request = yield* Iceberg.makeCreateTableCommitRequest(Row, {
 *   location: "s3://warehouse/rows"
 * })
 * ```
 */
export const makeCreateTableCommitRequest = (
  schema: Schema.Top,
  options: CreateTableCommitOptions,
): Effect.Effect<CommitTableRequest, IcebergSchemaError> =>
  Effect.try({
    try: () => {
      const document = Schema.toRepresentation(Schema.toType(schema));
      const table = new Compiler(document.references).compile(document.representation);
      const properties = {
        ...(table.description === undefined ? {} : { comment: table.description }),
        ...options.properties,
      };

      return {
        requirements: [{ type: "assert-create" }],
        updates: [
          { action: "assign-uuid", uuid: options.uuid ?? crypto.randomUUID() },
          { action: "upgrade-format-version", "format-version": 2 },
          { action: "add-schema", schema: table.schema },
          { action: "set-current-schema", "schema-id": -1 },
          { action: "add-spec", spec: { "spec-id": 0, fields: [] } },
          { action: "set-default-spec", "spec-id": -1 },
          { action: "add-sort-order", "sort-order": { "order-id": 0, fields: [] } },
          { action: "set-default-sort-order", "sort-order-id": -1 },
          { action: "set-location", location: options.location },
          ...(Object.keys(properties).length === 0
            ? []
            : [{ action: "set-properties" as const, updates: properties }]),
        ],
      };
    },
    catch: (cause) =>
      cause instanceof CompilationFailure
        ? new IcebergSchemaError({ path: cause.path, message: cause.message, cause })
        : new IcebergSchemaError({
            path: "$",
            message: cause instanceof Error ? cause.message : String(cause),
            cause,
          }),
  });
