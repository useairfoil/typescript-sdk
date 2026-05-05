import type { CallOptions } from "nice-grpc";

import { Config, Context, Effect, Layer, Scope, Stream } from "effect";

import type { FlightClientErrorLike } from "./flight-client-error";
import type { RemoveTypeUrl } from "./proto-utils";
import type { RecordBatchWithMetadata } from "./record-batch-with-metadata";

import {
  make as makeArrowFlightClient,
  type ArrowFlightClientOptions,
  type ArrowFlightClientService,
} from "./arrow-flight-client";
import { Any } from "./proto/any";
import { FlightDescriptor, FlightDescriptor_DescriptorType, type FlightInfo } from "./proto/Flight";
import {
  CommandGetCatalogs,
  CommandGetDbSchemas,
  CommandGetTables,
  CommandGetTableTypes,
  CommandStatementQuery,
} from "./proto/FlightSql";

export type ArrowFlightSqlClientOptions = ArrowFlightClientOptions;

export interface ArrowFlightSqlClientService {
  readonly executeFlightInfo: (
    info: FlightInfo,
    options?: CallOptions,
  ) => Stream.Stream<RecordBatchWithMetadata, FlightClientErrorLike>;
  readonly getCatalogs: (
    request: RemoveTypeUrl<CommandGetCatalogs>,
    options?: CallOptions,
  ) => Effect.Effect<FlightInfo, FlightClientErrorLike>;
  readonly getDbSchemas: (
    request: RemoveTypeUrl<CommandGetDbSchemas>,
    options?: CallOptions,
  ) => Effect.Effect<FlightInfo, FlightClientErrorLike>;
  readonly getTables: (
    request: RemoveTypeUrl<CommandGetTables>,
    options?: CallOptions,
  ) => Effect.Effect<FlightInfo, FlightClientErrorLike>;
  readonly getTableTypes: (
    request: RemoveTypeUrl<CommandGetTableTypes>,
    options?: CallOptions,
  ) => Effect.Effect<FlightInfo, FlightClientErrorLike>;
  readonly executeQuery: (
    request: RemoveTypeUrl<CommandStatementQuery>,
    options?: CallOptions,
  ) => Effect.Effect<FlightInfo, FlightClientErrorLike>;
}

export class ArrowFlightSqlClient extends Context.Service<
  ArrowFlightSqlClient,
  ArrowFlightSqlClientService
>()("@useairfoil/flight/ArrowFlightSqlClient") {}

export const make = Effect.fnUntraced(function* (
  options: ArrowFlightSqlClientOptions,
): Effect.fn.Return<ArrowFlightSqlClientService, never, Scope.Scope> {
  const inner: ArrowFlightClientService = yield* makeArrowFlightClient(options);

  return ArrowFlightSqlClient.of({
    executeFlightInfo: (info, options) => inner.executeFlightInfo(info, options),
    getCatalogs: (request, options) =>
      inner.getFlightInfo(
        createCommandDescriptor(
          CommandGetCatalogs.$type,
          CommandGetCatalogs.encode({
            $type: CommandGetCatalogs.$type,
            ...request,
          }).finish(),
        ),
        options,
      ),
    getDbSchemas: (request, options) =>
      inner.getFlightInfo(
        createCommandDescriptor(
          CommandGetDbSchemas.$type,
          CommandGetDbSchemas.encode({
            $type: CommandGetDbSchemas.$type,
            ...request,
          }).finish(),
        ),
        options,
      ),
    getTables: (request, options) =>
      inner.getFlightInfo(
        createCommandDescriptor(
          CommandGetTables.$type,
          CommandGetTables.encode({
            $type: CommandGetTables.$type,
            ...request,
          }).finish(),
        ),
        options,
      ),
    getTableTypes: (request, options) =>
      inner.getFlightInfo(
        createCommandDescriptor(
          CommandGetTableTypes.$type,
          CommandGetTableTypes.encode({
            $type: CommandGetTableTypes.$type,
            ...request,
          }).finish(),
        ),
        options,
      ),
    executeQuery: (request, options) =>
      inner.getFlightInfo(
        createCommandDescriptor(
          CommandStatementQuery.$type,
          CommandStatementQuery.encode({
            $type: CommandStatementQuery.$type,
            ...request,
          }).finish(),
        ),
        options,
      ),
  });
});

export const layer = (options: ArrowFlightSqlClientOptions): Layer.Layer<ArrowFlightSqlClient> =>
  Layer.effect(ArrowFlightSqlClient, make(options));

export const layerConfig = (options: Config.Wrap<ArrowFlightSqlClientOptions>) =>
  Layer.effect(
    ArrowFlightSqlClient,
    Effect.gen(function* () {
      const resolved = yield* Config.unwrap(options);
      return yield* make(resolved);
    }),
  );

function createCommandDescriptor(typeUrl: string, value: Uint8Array): FlightDescriptor {
  const cmd = Any.create({
    typeUrl: `type.googleapis.com/${typeUrl}`,
    value,
  });

  return FlightDescriptor.create({
    type: FlightDescriptor_DescriptorType.CMD,
    cmd: Any.encode(cmd).finish(),
  });
}

export type { CallOptions, FlightInfo, RecordBatchWithMetadata };
