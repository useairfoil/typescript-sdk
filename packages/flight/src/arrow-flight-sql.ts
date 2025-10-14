import type { CallOptions } from "nice-grpc";
import { ArrowFlightClient } from "./arrow-flight";
import { Any } from "./proto/any";
import {
  FlightDescriptor,
  FlightDescriptor_DescriptorType,
  type FlightInfo,
  type FlightServiceDefinition,
} from "./proto/Flight";
import {
  CommandGetCatalogs,
  CommandGetDbSchemas,
  CommandGetTables,
  CommandGetTableTypes,
  CommandStatementQuery,
} from "./proto/FlightSql";
import type {
  ClientOptions,
  HostOrChannel,
  RemoveTypeUrl,
} from "./proto-utils";

export class ArrowFlightSqlClient {
  private inner: ArrowFlightClient;

  constructor(
    config: HostOrChannel,
    options: ClientOptions<FlightServiceDefinition> = {},
  ) {
    this.inner = new ArrowFlightClient(config, options);
  }

  executeFlightInfo(request: FlightInfo, options?: CallOptions) {
    return this.inner.executeFlightInfo(request, options);
  }

  async getCatalogs(
    request: RemoveTypeUrl<CommandGetCatalogs>,
    options?: CallOptions,
  ) {
    const descriptor = createCommandDescriptor(
      CommandGetCatalogs.$type,
      CommandGetCatalogs.encode({
        $type: CommandGetCatalogs.$type,
        ...request,
      }).finish(),
    );
    return this.inner.getFlightInfo(descriptor, options);
  }

  async getDbSchemas(
    request: RemoveTypeUrl<CommandGetDbSchemas>,
    options?: CallOptions,
  ) {
    const descriptor = createCommandDescriptor(
      CommandGetDbSchemas.$type,
      CommandGetDbSchemas.encode({
        $type: CommandGetDbSchemas.$type,
        ...request,
      }).finish(),
    );
    return this.inner.getFlightInfo(descriptor, options);
  }

  async getTables(
    request: RemoveTypeUrl<CommandGetTables>,
    options?: CallOptions,
  ) {
    const descriptor = createCommandDescriptor(
      CommandGetTables.$type,
      CommandGetTables.encode({
        $type: CommandGetTables.$type,
        ...request,
      }).finish(),
    );
    return this.inner.getFlightInfo(descriptor, options);
  }

  async getTableTypes(
    request: RemoveTypeUrl<CommandGetTableTypes>,
    options?: CallOptions,
  ) {
    const descriptor = createCommandDescriptor(
      CommandGetTableTypes.$type,
      CommandGetTableTypes.encode({
        $type: CommandGetTableTypes.$type,
        ...request,
      }).finish(),
    );
    return this.inner.getFlightInfo(descriptor, options);
  }

  async executeQuery(
    request: RemoveTypeUrl<CommandStatementQuery>,
    options?: CallOptions,
  ) {
    const descriptor = createCommandDescriptor(
      CommandStatementQuery.$type,
      CommandStatementQuery.encode({
        $type: CommandStatementQuery.$type,
        ...request,
      }).finish(),
    );
    return this.inner.getFlightInfo(descriptor, options);
  }
}

function createCommandDescriptor(
  typeUrl: string,
  value: Uint8Array,
): FlightDescriptor {
  const cmd = Any.create({
    typeUrl: `type.googleapis.com/${typeUrl}`,
    value,
  });

  return FlightDescriptor.create({
    type: FlightDescriptor_DescriptorType.CMD,
    cmd: Any.encode(cmd).finish(),
  });
}
