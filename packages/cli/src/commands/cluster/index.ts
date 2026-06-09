import { Effect } from "effect";
import { Command } from "effect/unstable/cli";

import { createNamespaceCommand } from "./namespace/create";
import { deleteNamespaceCommand } from "./namespace/delete";
import { getNamespaceCommand } from "./namespace/get";
import { listNamespacesCommand } from "./namespace/list";
import { createTableCommand } from "./table/create";
import { deleteTableCommand } from "./table/delete";
import { getTableCommand } from "./table/get";
import { listTablesCommand } from "./table/list";

export const clusterCommand = Command.make("cluster", {}, () => Effect.void).pipe(
  Command.withDescription("Interact with the cluster metadata server"),
  Command.withSubcommands([
    createNamespaceCommand,
    listNamespacesCommand,
    getNamespaceCommand,
    deleteNamespaceCommand,
    createTableCommand,
    listTablesCommand,
    getTableCommand,
    deleteTableCommand,
  ]),
);
