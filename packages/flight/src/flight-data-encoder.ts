import { Message, type RecordBatch, type Schema } from "apache-arrow";
import * as metadata from "apache-arrow/ipc/metadata/message";
import { VectorAssembler } from "apache-arrow/visitor/vectorassembler";
import { FlightData, type FlightDescriptor } from "./proto/Flight";

export const FlightDataEncoder = {
  encodeSchema(
    schema: Schema,
    {
      flightDescriptor,
      appMetadata,
    }: { flightDescriptor: FlightDescriptor; appMetadata?: Uint8Array },
  ): FlightData {
    const message = Message.from(schema);
    return FlightData.create({
      dataHeader: Message.encode(message),
      appMetadata,
      flightDescriptor,
    });
  },
  encodeBatch(
    batch: RecordBatch,
    {
      appMetadata,
    }: {
      appMetadata?: (args: {
        index: number;
        length: number;
      }) => Uint8Array | undefined;
    } = {},
  ): ReadonlyArray<FlightData> {
    const { byteLength, nodes, bufferRegions, buffers } =
      VectorAssembler.assemble(batch);

    const metadataRecordBatch = new metadata.RecordBatch(
      batch.numRows,
      nodes,
      bufferRegions,
      null,
    );

    const message = Message.from(metadataRecordBatch, byteLength);

    const flightData = FlightData.create({
      dataHeader: Message.encode(message),
      appMetadata: appMetadata?.({ index: 0, length: 1 }),
      dataBody: encodeRecordBatchContent(buffers, byteLength, null),
    });

    return [flightData];
  },
};

// Write the content of the record batch to the output buffer.
//
// This code is taken from the arrow-js ipc module.
// https://github.com/apache/arrow-js/blob/870e27eb3e467a6f2936e8d17c5e021c5eb07ad7/src/ipc/writer.ts
//
// Licensed to the Apache Software Foundation (ASF) under one or more
// contributor license agreements. See the NOTICE file distributed with this
// work for additional information regarding copyright ownership. The ASF
// licenses this file to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
// WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
// License for the specific language governing permissions and limitations under
// the License.
function encodeRecordBatchContent(
  buffers: ArrayBufferView<ArrayBufferLike>[],
  byteLength: number,
  compression: metadata.BodyCompression | null = null,
): Uint8Array {
  const out = new Uint8Array(byteLength);
  const bufGroupSize = compression != null ? 2 : 1;
  const bufs = new Array(bufGroupSize);
  let pos = 0;

  for (let i = 0; i < buffers.length; i += bufGroupSize) {
    let size = 0;
    for (let j = -1; ++j < bufGroupSize; ) {
      bufs[j] = buffers[i + j];
      size += bufs[j].byteLength;
    }

    if (size === 0) {
      continue;
    }

    for (const buf of bufs) {
      out.set(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength), pos);
      pos += buf.byteLength;
    }

    const padding = ((size + 7) & ~7) - size;

    if (padding > 0) {
      out.set(new Uint8Array(padding), pos);
      pos += padding;
    }
  }

  return out;
}
