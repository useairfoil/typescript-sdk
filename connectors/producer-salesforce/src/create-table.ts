import { ConnectorApp } from "@useairfoil/connector-kit";

import { tableSchemas } from "./tables";

export const createTableCommand = ConnectorApp.makeCreateTableCommand(tableSchemas);
