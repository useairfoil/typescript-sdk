import { EventEmitter } from "node:stream";
import { type ArrowFlightClient, type Metadata, proto } from "@airfoil/flight";
import type { DeserializedTopic } from "../lib/utils";
import { Any, } from "../proto/wings/utils";

function anyMessage(typeUrl: string, value: Uint8Array) {
  return Any.encode({
    typeUrl,
    value,
  }).finish();
}

export async function createPushClient({
  topic,
  flightClient,
  namespace,
  metadata,
}: {
  topic: DeserializedTopic;
  flightClient: ArrowFlightClient;
  namespace: string;
  metadata: Metadata;
}) {
  const channel = new EventEmitter();

  const response = flightClient.doPut(channelToAsyncIterable(channel), {
    metadata,
  });

  for await (const message of response) {
    console.log(message);
  }
}
async function* channelToAsyncIterable(channel: EventEmitter) {
  channel.on("data", (data) => {
    yield proto.arrow_flight.FlightData.create({});
  });
}
