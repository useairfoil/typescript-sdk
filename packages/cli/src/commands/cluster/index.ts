import { Command } from "commander";
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

export const clusterCommand = new Command("cluster")
  .description("Interact with the cluster metadata server")
  .addCommand(createTenantCommand)
  .addCommand(listTenantsCommand)
  .addCommand(getTenantCommand)
  .addCommand(deleteTenantCommand)
  .addCommand(createNamespaceCommand)
  .addCommand(listNamespacesCommand)
  .addCommand(getNamespaceCommand)
  .addCommand(deleteNamespaceCommand)
  .addCommand(createTopicCommand)
  .addCommand(listTopicsCommand)
  .addCommand(getTopicCommand)
  .addCommand(deleteTopicCommand)
  .addCommand(createObjectStoreCommand)
  .addCommand(listObjectStoresCommand)
  .addCommand(getObjectStoreCommand)
  .addCommand(deleteObjectStoreCommand)
  .addCommand(createDataLakeCommand)
  .addCommand(listDataLakesCommand)
  .addCommand(getDataLakeCommand)
  .addCommand(deleteDataLakeCommand);
