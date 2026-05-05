import { Effect } from "effect";
import { Command } from "effect/unstable/cli";

import { createDataLakeCommand } from "./data-lake/create";
import { deleteDataLakeCommand } from "./data-lake/delete";
import { getDataLakeCommand } from "./data-lake/get";
import { listDataLakesCommand } from "./data-lake/list";
import { createNamespaceCommand } from "./namespace/create";
import { deleteNamespaceCommand } from "./namespace/delete";
import { getNamespaceCommand } from "./namespace/get";
import { listNamespacesCommand } from "./namespace/list";
import { createObjectStoreCommand } from "./object-store/create";
import { deleteObjectStoreCommand } from "./object-store/delete";
import { getObjectStoreCommand } from "./object-store/get";
import { listObjectStoresCommand } from "./object-store/list";
import { createTenantCommand } from "./tenant/create";
import { deleteTenantCommand } from "./tenant/delete";
import { getTenantCommand } from "./tenant/get";
import { listTenantsCommand } from "./tenant/list";
import { createTopicCommand } from "./topic/create";
import { deleteTopicCommand } from "./topic/delete";
import { getTopicCommand } from "./topic/get";
import { listTopicsCommand } from "./topic/list";

export const clusterCommand = Command.make("cluster", {}, () => Effect.void).pipe(
  Command.withDescription("Interact with the cluster metadata server"),
  Command.withSubcommands([
    createTenantCommand,
    listTenantsCommand,
    getTenantCommand,
    deleteTenantCommand,
    createNamespaceCommand,
    listNamespacesCommand,
    getNamespaceCommand,
    deleteNamespaceCommand,
    createTopicCommand,
    listTopicsCommand,
    getTopicCommand,
    deleteTopicCommand,
    createObjectStoreCommand,
    listObjectStoresCommand,
    getObjectStoreCommand,
    deleteObjectStoreCommand,
    createDataLakeCommand,
    listDataLakesCommand,
    getDataLakeCommand,
    deleteDataLakeCommand,
  ]),
);
