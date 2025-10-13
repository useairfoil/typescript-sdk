import type { ArrowFlightClient, Metadata } from "@airfoil/flight";
import type { DeserializedTopic } from "../lib/utils";
import { Any, FetchTicket } from "../proto/wings/utils";

function anyMessage(typeUrl: string, value: Uint8Array) {
  return Any.encode({
    typeUrl,
    value,
  }).finish();
}

export async function createFetchClient({
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
  const ticket = anyMessage(
    "type.googleapis.com/wings.v1.FetchTicket",
    FetchTicket.encode({
      topicName: topic.name,
      partitionValue: undefined,
      offset: 0n,
    }).finish(),
  );

  const req = {
    ticket,
  };

  const response = flightClient.doGet(req, {
    metadata,
  });

  for await (const message of response) {
    console.log(message);
  }
}
