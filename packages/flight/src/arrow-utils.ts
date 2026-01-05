import { Message, type Schema } from "apache-arrow";
import type { FlightData, FlightInfo } from "./proto/Flight";
import { RecordBatchStreamReaderFromFlightData } from "./record-batch-decoder";

export function decodeSchemaFromFlightInfo(
  info: FlightInfo,
): Schema | undefined {
  // Notice that the `info.schema` field has the following format:
  // The schema of the dataset in its IPC form:
  //   4 bytes - an optional IPC_CONTINUATION_TOKEN prefix
  //   4 bytes - the byte length of the payload
  //   a flatbuffer Message whose header is the Schema
  const message = Message.decode(info.schema.slice(8));
  return getMessageSchema(message);
}

export function getMessageSchema(message: Message): Schema | undefined {
  if (message.isSchema()) {
    return message.header();
  }
  return undefined;
}

export function decodeFlightDataStream(
  stream: AsyncIterable<FlightData>,
  { expectedSchema: _expectedSchema }: { expectedSchema: Schema },
) {
  // TODO: we want to validate the schema of the stream?
  return new RecordBatchStreamReaderFromFlightData(stream);
}
