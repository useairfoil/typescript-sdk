import type { FlightData } from "@airfoil/flight";
import * as arrow from "apache-arrow";

/**
 * Adds Arrow IPC stream framing to FlightData components.
 *
 * FlightData separates header and body, but RecordBatchReader expects the full IPC format.
 * This replicates what RecordBatchWriter._writeMessage() does internally.
 *
 * @see https://github.com/apache/arrow-js/blob/d6010ece19ac0d1a25eb5383d3e8e77960dd5f31/src/ipc/writer.ts#L219-L243
 */
function reconstructIPCMessage(
  dataHeader: Uint8Array,
  dataBody: Uint8Array,
): Uint8Array {
  // FlightData.dataHeader is already FlatBuffer-encoded by server
  const metadataLength = dataHeader.length;
  const bodyLength = dataBody.length;

  // Calculate padding for 8-byte alignment
  const metadataPadding = (8 - (metadataLength % 8)) % 8;
  const bodyPadding = (8 - (bodyLength % 8)) % 8;

  // Total message size: continuation(4) + length(4) + metadata + padding + body + padding
  const totalSize =
    4 + 4 + metadataLength + metadataPadding + bodyLength + bodyPadding;

  const message = new Uint8Array(totalSize);
  const view = new DataView(message.buffer);

  let offset = 0;

  // Write continuation marker (0xFFFFFFFF = -1 in signed int32)
  view.setInt32(offset, -1, true); // true = little-endian
  offset += 4;

  // Write metadata length
  view.setInt32(offset, metadataLength, true);
  offset += 4;

  // Write metadata (dataHeader)
  message.set(dataHeader, offset);
  offset += metadataLength;
  // Skip metadata padding (already zero-filled in pre-allocated array)

  offset += metadataPadding;
  // Write message body (dataBody)

  message.set(dataBody, offset);

  return message;
}

/**
 * Converts FlightData stream to Arrow IPC stream format.
 */
async function* flightDataToIPCStream(
  flightDataStream: AsyncIterable<FlightData>,
): AsyncIterable<Uint8Array> {
  for await (const flightData of flightDataStream) {
    if (flightData.dataHeader && flightData.dataHeader.length > 0) {
      const ipcMessage = reconstructIPCMessage(
        flightData.dataHeader,
        flightData.dataBody || new Uint8Array(0),
      );
      yield ipcMessage;
    }
  }
}

/**
 * Decodes FlightData and yields RecordBatches.
 */
export async function* decodeFlightDataToBatches(
  flightDataStream: AsyncIterable<FlightData>,
): AsyncIterable<arrow.RecordBatch> {
  const ipcStream = flightDataToIPCStream(flightDataStream);
  const reader = await arrow.RecordBatchReader.from(ipcStream);

  for await (const batch of reader) {
    yield batch;
  }
}
