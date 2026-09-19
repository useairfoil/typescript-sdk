import { Effect, Option } from "effect";
import { Argument, Command, Flag } from "effect/unstable/cli";

import { getIcebergCatalog, parseNamespaceIdentifier } from "../utils/iceberg";
import { catalogFlag } from "../utils/options";

const namespaceArgument = Argument.string("namespace").pipe(
  Argument.withDescription("Namespace name. Use dot-separated notation for nested namespaces"),
);

const parentFlag = Flag.string("parent").pipe(
  Flag.withDescription("Parent namespace. Use dot-separated notation for nested namespaces"),
  Flag.optional,
);

const createCommand = Command.make(
  "create",
  { namespace: namespaceArgument, catalog: catalogFlag },
  ({ namespace, catalog }) =>
    Effect.gen(function* () {
      const id = yield* parseNamespaceIdentifier(namespace);
      const iceberg = yield* getIcebergCatalog(catalog);
      const created = yield* iceberg.createNamespace(id);

      yield* Effect.log(created);
    }),
).pipe(Command.withDescription("Create a new namespace"));

const getCommand = Command.make(
  "get",
  { namespace: namespaceArgument, catalog: catalogFlag },
  ({ namespace, catalog }) =>
    Effect.gen(function* () {
      const id = yield* parseNamespaceIdentifier(namespace);
      const iceberg = yield* getIcebergCatalog(catalog);
      const metadata = yield* iceberg.loadNamespaceMetadata(id);

      yield* Effect.log({ ...id, ...metadata });
    }),
).pipe(Command.withDescription("Get a namespace"));

const deleteCommand = Command.make(
  "delete",
  { namespace: namespaceArgument, catalog: catalogFlag },
  ({ namespace, catalog }) =>
    Effect.gen(function* () {
      const id = yield* parseNamespaceIdentifier(namespace);
      const iceberg = yield* getIcebergCatalog(catalog);

      yield* iceberg.dropNamespace(id);
      yield* Effect.log(id);
    }),
).pipe(Command.withDescription("Delete a namespace"));

const listCommand = Command.make(
  "list",
  { parent: parentFlag, catalog: catalogFlag },
  ({ parent, catalog }) =>
    Effect.gen(function* () {
      const iceberg = yield* getIcebergCatalog(catalog);
      const parentName = Option.getOrUndefined(parent);
      const parentId =
        parentName === undefined ? undefined : yield* parseNamespaceIdentifier(parentName);
      const result = yield* iceberg.listNamespaces(
        parentId === undefined ? undefined : { parent: parentId },
      );

      yield* Effect.log(result);
    }),
).pipe(Command.withDescription("List namespaces"));

export const namespaceCommand = Command.make("namespace").pipe(
  Command.withDescription("Manage namespaces"),
  Command.withSubcommands([createCommand, getCommand, deleteCommand, listCommand]),
);
