import type { RecordBatch, Schema } from "apache-arrow";

import { Config, Context, Effect, Layer, Scope, Stream } from "effect";
import {
  type CallOptions,
  createClient,
  type DefaultCallOptions,
  type NormalizedServiceDefinition,
} from "nice-grpc";

import type { RecordBatchWithMetadata } from "./record-batch-with-metadata";

import { decodeFlightDataStream, decodeSchemaFromFlightInfo } from "./arrow-utils";
import {
  FlightDecodeError,
  type FlightClientErrorLike,
  FlightProtocolError,
  FlightTransportError,
} from "./flight-client-error";
import { type ClientOptions, createChannelFromConfig, type HostOrChannel } from "./proto-utils";
import {
  type FlightData,
  type FlightDescriptor,
  type FlightInfo,
  type FlightServiceClient,
  FlightServiceDefinition,
  type HandshakeRequest,
  type HandshakeResponse,
  type PutResult,
  type Ticket,
} from "./proto/Flight";

export type ArrowFlightClientOptions = HostOrChannel & {
  readonly defaultCallOptions?: DefaultCallOptions<
    NormalizedServiceDefinition<FlightServiceDefinition>
  >;
};

export interface ArrowFlightClientService {
  readonly handshake: (
    request: AsyncIterable<HandshakeRequest>,
    options?: CallOptions,
  ) => Stream.Stream<HandshakeResponse, FlightClientErrorLike>;
  readonly getFlightInfo: (
    request: FlightDescriptor,
    options?: CallOptions,
  ) => Effect.Effect<FlightInfo, FlightClientErrorLike>;
  readonly doGet: (
    request: Ticket,
    options: { readonly schema: Schema } & CallOptions,
  ) => Stream.Stream<RecordBatchWithMetadata, FlightClientErrorLike>;
  readonly doPut: (
    request: AsyncIterable<FlightData>,
    options?: CallOptions,
  ) => AsyncIterable<PutResult>;
  readonly executeFlightInfo: (
    info: FlightInfo,
    options?: CallOptions,
  ) => Stream.Stream<RecordBatchWithMetadata, FlightClientErrorLike>;
}

export class ArrowFlightClient extends Context.Service<
  ArrowFlightClient,
  ArrowFlightClientService
>()("@useairfoil/flight/ArrowFlightClient") {}

const mapTransportError = (message: string, cause: unknown) =>
  new FlightTransportError({
    message,
    cause,
  });

const mapDecodeError = (message: string, cause: unknown) =>
  new FlightDecodeError({
    message,
    cause,
  });

const streamFromAsyncIterable = <A>(
  iterable: AsyncIterable<A>,
  message: string,
): Stream.Stream<A, FlightTransportError> =>
  Stream.fromAsyncIterable(iterable, (cause) => mapTransportError(message, cause));

export const make = Effect.fnUntraced(function* (
  options: ArrowFlightClientOptions,
): Effect.fn.Return<ArrowFlightClientService, never, Scope.Scope> {
  const ownsChannel = "host" in options;
  const channel = createChannelFromConfig(options);
  const client: FlightServiceClient = createClient(
    FlightServiceDefinition,
    channel,
    options.defaultCallOptions,
  );

  if (ownsChannel) {
    const scope = yield* Scope.Scope;
    yield* Scope.addFinalizer(
      scope,
      Effect.sync(() => {
        channel.close();
      }),
    );
  }

  const doGet = (
    request: Ticket,
    options: { readonly schema: Schema } & CallOptions,
  ): Stream.Stream<RecordBatchWithMetadata, FlightClientErrorLike> => {
    const { schema: expectedSchema } = options;
    return Stream.fromAsyncIterable(
      decodeFlightDataStream(client.doGet(request, options), { expectedSchema }),
      (cause) => mapDecodeError("Flight batch decoding failed", cause),
    );
  };

  const executeFlightInfo = (
    info: FlightInfo,
    options?: CallOptions,
  ): Stream.Stream<RecordBatchWithMetadata, FlightClientErrorLike> => {
    const schema = decodeSchemaFromFlightInfo(info);
    if (!schema) {
      return Stream.fail(
        new FlightProtocolError({
          message: "FlightInfo must include a schema",
        }),
      );
    }

    return Stream.fromIterable(info.endpoint).pipe(
      Stream.flatMap((endpoint) =>
        endpoint.ticket === undefined
          ? Stream.empty
          : doGet(endpoint.ticket, {
              schema,
              ...options,
            }),
      ),
    );
  };

  return ArrowFlightClient.of({
    handshake: (request, options) =>
      streamFromAsyncIterable(client.handshake(request, options), "Flight handshake failed"),
    getFlightInfo: (request, options) =>
      Effect.tryPromise({
        try: () => client.getFlightInfo(request, options),
        catch: (cause) => mapTransportError("Flight getFlightInfo failed", cause),
      }),
    doGet,
    doPut: (request, options) => client.doPut(request, options),
    executeFlightInfo,
  });
});

export const layer = (options: ArrowFlightClientOptions): Layer.Layer<ArrowFlightClient> =>
  Layer.effect(ArrowFlightClient, make(options));

export const layerConfig = (options: Config.Wrap<ArrowFlightClientOptions>) =>
  Layer.effect(
    ArrowFlightClient,
    Effect.gen(function* () {
      const resolved = yield* Config.unwrap(options);
      return yield* make(resolved);
    }),
  );

export type { CallOptions, ClientOptions, HostOrChannel, RecordBatch, RecordBatchWithMetadata };
