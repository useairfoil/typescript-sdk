import type { RecordBatch, Schema } from "apache-arrow";
import { type CallOptions, createClient } from "nice-grpc";
import {
  decodeFlightDataStream,
  decodeSchemaFromFlightInfo,
} from "./arrow-utils";
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
import {
  type ClientOptions,
  createChannelFromConfig,
  type HostOrChannel,
} from "./proto-utils";

export class ArrowFlightClient {
  private client: FlightServiceClient;

  constructor(
    config: HostOrChannel,
    options: ClientOptions<FlightServiceDefinition> = {},
  ) {
    const channel = createChannelFromConfig(config);

    this.client = createClient(
      FlightServiceDefinition,
      channel,
      options.defaultCallOptions,
    );
  }

  executeFlightInfo(
    info: FlightInfo,
    options?: CallOptions,
  ): AsyncGenerator<RecordBatch> {
    const schema = decodeSchemaFromFlightInfo(info);
    if (!schema) {
      throw new Error("FlightInfo must have a schema");
    }

    const client = this;

    return (async function* () {
      for (const endpoint of info.endpoint) {
        if (endpoint.ticket === undefined) {
          continue;
        }

        yield* client.doGet(endpoint.ticket, { schema, ...options });
      }
    })();
  }

  /**
   * Handshake between client and server.
   *
   * Depending on the server, the handshake may be required to determine the
   * token that should be used for future operations. Both request and response
   * are streams to allow multiple round-trips depending on auth mechanism.
   */
  handshake(
    request: AsyncIterable<HandshakeRequest>,
    options?: CallOptions,
  ): AsyncIterable<HandshakeResponse> {
    return this.client.handshake(request, options);
  }

  /** Get a list of available streams given a particular criteria. */
  // listFlights(
  //   request: proto.arrow_flight.Criteria,
  //   options?: ClientCallOptions,
  // ): AsyncIterable<proto.arrow_flight.FlightInfo>;

  getFlightInfo(
    request: FlightDescriptor,
    options?: CallOptions,
  ): Promise<FlightInfo> {
    return this.client.getFlightInfo(request, options);
  }

  // /** Start a query and get information to poll its execution status. */
  // pollFlightInfo(
  //   request: proto.arrow_flight.FlightDescriptor,
  //   options?: ClientCallOptions,
  // ): Promise<proto.arrow_flight.PollInfo>;

  // /** Get the schema for a given FlightDescriptor. */
  // getSchema(
  //   request: proto.arrow_flight.FlightDescriptor,
  //   options?: ClientCallOptions,
  // ): Promise<proto.arrow_flight.SchemaResult>;

  /**
   * Retrieve a single stream associated with a particular descriptor
   * associated with the referenced ticket. A Flight can be composed of one or
   * more streams where each stream can be retrieved using a separate opaque
   * ticket that the flight service uses for managing a collection of streams.
   */
  doGet(
    request: Ticket,
    options: { schema: Schema } & CallOptions,
  ): AsyncIterable<RecordBatch> {
    const { schema: expectedSchema } = options;
    return decodeFlightDataStream(this.client.doGet(request, options), {
      expectedSchema,
    });
  }

  /**
   * Push a stream to the flight service associated with a particular
   * flight stream. This allows a client of a flight service to upload a stream
   * of data. Depending on the particular flight service, a client consumer
   * could be allowed to upload a single stream per descriptor or an unlimited
   * number. In the latter, the service might implement a 'seal' action that
   * can be applied to a descriptor once all streams are uploaded.
   */
  doPut(
    request: AsyncIterable<FlightData>,
    options?: CallOptions,
  ): AsyncIterable<PutResult> {
    return this.client.doPut(request, options);
  }

  // /** Open a bidirectional data channel for a given descriptor. */
  // doExchange(
  //   request: AsyncIterable<proto.arrow_flight.FlightData>,
  //   options?: ClientCallOptions,
  // ): AsyncIterable<proto.arrow_flight.FlightData>;

  // /** Execute a specific action against the flight service. */
  // doAction(
  //   request: proto.arrow_flight.Action,
  //   options?: ClientCallOptions,
  // ): AsyncIterable<proto.arrow_flight.Result>;

  // /** Get all available action types. */
  // listActions(
  //   request: proto.arrow_flight.Empty,
  //   options?: ClientCallOptions,
  // ): AsyncIterable<proto.arrow_flight.ActionType>;
}
