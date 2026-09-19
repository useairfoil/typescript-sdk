import { Effect, Option } from "effect";
import { Argument, CliError, Command, Flag } from "effect/unstable/cli";

import {
  getIcebergCatalog,
  listAllNamespaces,
  listAllTables,
  parseNamespaceIdentifier,
  parseTableIdentifier,
} from "../utils/iceberg";
import { parseTableFields } from "../utils/json";
import { catalogFlag } from "../utils/options";

const tableArgument = Argument.string("table").pipe(
  Argument.withDescription("Fully qualified table name"),
);

const namespaceArgument = Argument.string("namespace").pipe(
  Argument.withDescription("Namespace name. Use dot-separated notation for nested namespaces"),
  Argument.optional,
);

const allFlag = Flag.boolean("all").pipe(
  Flag.withDescription("List tables from all namespaces"),
  Flag.withDefault(false),
);

const schemaFlag = Flag.string("schema").pipe(
  Flag.withDescription("Iceberg table fields as a JSON array"),
);

const createCommand = Command.make(
  "create",
  { table: tableArgument, schema: schemaFlag, catalog: catalogFlag },
  ({ table, schema, catalog }) =>
    Effect.gen(function* () {
      const id = yield* parseTableIdentifier(table);
      const fields = yield* parseTableFields(schema);
      const iceberg = yield* getIcebergCatalog(catalog);
      const metadata = yield* iceberg.createTable(
        { namespace: id.namespace },
        { name: id.name, schema: { type: "struct", fields } },
      );

      yield* Effect.log({ ...id, metadata });
    }),
).pipe(Command.withDescription("Create a new table"));

const getCommand = Command.make(
  "get",
  { table: tableArgument, catalog: catalogFlag },
  ({ table, catalog }) =>
    Effect.gen(function* () {
      const id = yield* parseTableIdentifier(table);
      const iceberg = yield* getIcebergCatalog(catalog);
      const metadata = yield* iceberg.loadTable(id);

      yield* Effect.log({ ...id, metadata });
    }),
).pipe(Command.withDescription("Get a table"));

const deleteCommand = Command.make(
  "delete",
  { table: tableArgument, catalog: catalogFlag },
  ({ table, catalog }) =>
    Effect.gen(function* () {
      const id = yield* parseTableIdentifier(table);
      const iceberg = yield* getIcebergCatalog(catalog);

      yield* iceberg.dropTable(id);
      yield* Effect.log(id);
    }),
).pipe(Command.withDescription("Delete a table"));

const listCommand = Command.make(
  "list",
  { namespace: namespaceArgument, all: allFlag, catalog: catalogFlag },
  ({ namespace, all, catalog }) =>
    Effect.gen(function* () {
      const namespaceName = Option.getOrUndefined(namespace);

      if (namespaceName === undefined && !all) {
        return yield* new CliError.UserError({
          cause: "Missing table list selector",
          userMessage: "Provide a namespace or use --all",
        });
      }

      if (namespaceName !== undefined && all) {
        return yield* new CliError.UserError({
          cause: "Conflicting table list selectors",
          userMessage: "Provide either a namespace or --all, not both",
        });
      }

      const iceberg = yield* getIcebergCatalog(catalog);
      const tables =
        namespaceName === undefined
          ? (yield* Effect.forEach(yield* listAllNamespaces(iceberg), (namespace) =>
              listAllTables(iceberg, namespace),
            )).flat()
          : yield* listAllTables(iceberg, yield* parseNamespaceIdentifier(namespaceName));

      yield* Effect.log({ namespace: namespaceName, tables });
    }),
).pipe(Command.withDescription("List tables"));

export const tableCommand = Command.make("table").pipe(
  Command.withDescription("Manage tables"),
  Command.withSubcommands([createCommand, getCommand, deleteCommand, listCommand]),
);
