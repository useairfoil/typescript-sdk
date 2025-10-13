import type { RecordBatch, Schema } from "apache-arrow";
import {
  type CallOptions,
  type ChannelCredentials,
  type ChannelOptions,
  createChannel,
  createClient,
  type DefaultCallOptions,
  type NormalizedServiceDefinition,
} from "nice-grpc";
import {
  decodeFlightDataStream,
  decodeSchemaFromFlightInfo,
} from "./arrow-utils";
import {
  type FlightDescriptor,
  type FlightInfo,
  type FlightServiceClient,
  FlightServiceDefinition,
  type HandshakeRequest,
  type HandshakeResponse,
  type Ticket,
} from "./proto/Flight";

export class ArrowFlightClient {
  private client: FlightServiceClient;

  constructor(
    url: string,
    options: {
      defaultCallOptions?: DefaultCallOptions<
        NormalizedServiceDefinition<FlightServiceDefinition>
      >;
      credentials?: ChannelCredentials;
      channelOptions?: ChannelOptions;
    } = {},
  ) {
    const channel = createChannel(
      url,
      options.credentials,
      options.channelOptions,
    );

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
    const { schema: expectedSchema, ...callOptions } = options;
    return decodeFlightDataStream(this.client.doGet(request, options), {
      expectedSchema,
    });
  }

  // /** Push a stream to the flight service. */
  // doPut(
  //   request: AsyncIterable<proto.arrow_flight.FlightData>,
  //   options?: ClientCallOptions,
  // ): AsyncIterable<proto.arrow_flight.PutResult>;

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
