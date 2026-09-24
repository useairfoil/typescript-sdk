import { ConnectorApp } from "@useairfoil/connector-kit";

import { tableSchemas } from "./schemas";

export const createTableCommand = ConnectorApp.makeCreateTableCommand(tableSchemas);
