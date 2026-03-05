import { Effect } from "effect";
import { Command } from "effect/unstable/cli";
import { createDataLakeCommand } from "./data-lake/create.js";
import { deleteDataLakeCommand } from "./data-lake/delete.js";
import { getDataLakeCommand } from "./data-lake/get.js";
import { listDataLakesCommand } from "./data-lake/list.js";
import { createNamespaceCommand } from "./namespace/create.js";
import { deleteNamespaceCommand } from "./namespace/delete.js";
import { getNamespaceCommand } from "./namespace/get.js";
import { listNamespacesCommand } from "./namespace/list.js";
import { createObjectStoreCommand } from "./object-store/create.js";
import { deleteObjectStoreCommand } from "./object-store/delete.js";
import { getObjectStoreCommand } from "./object-store/get.js";
import { listObjectStoresCommand } from "./object-store/list.js";
import { createTenantCommand } from "./tenant/create.js";
import { deleteTenantCommand } from "./tenant/delete.js";
import { getTenantCommand } from "./tenant/get.js";
import { listTenantsCommand } from "./tenant/list.js";
import { createTopicCommand } from "./topic/create.js";
import { deleteTopicCommand } from "./topic/delete.js";
import { getTopicCommand } from "./topic/get.js";
import { listTopicsCommand } from "./topic/list.js";

export const clusterCommand = Command.make(
  "cluster",
  {},
  () => Effect.void,
).pipe(
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
