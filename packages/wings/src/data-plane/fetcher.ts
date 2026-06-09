import type { ArrowFlightClientService } from "@useairfoil/flight";
import type { RecordBatch } from "apache-arrow";

import { Effect, Ref, Stream } from "effect";

import type { FetchOptions } from "./service";

import { Codec as ArrowTypeCodec } from "../cluster/arrow-type";
import { WingsError } from "../errors";
import { arrowSchemaFromProto } from "../lib/arrow";
import { Any } from "../proto/google/protobuf/any";
import { FetchTicket } from "../proto/wings/flight/fetch";
import { createTicket } from "../utils/proto-utils";

/**
 * Streams record batches from a table.
 *
 * Polls continuously — empty results do not stop the stream. The stream tracks the
 * offset from each response's `__offset__` column and resumes from where it left off
 * on the next poll. Interrupt the stream to stop it.
 *
 * @example
 * // Take 10 batches then stop
 * stream.pipe(Stream.take(10), Stream.runCollect)
 *
 * @example
 * // Run in a background fiber, stop when the scope closes
 * yield* stream.pipe(Stream.runDrain, Effect.forkScoped)
 */
export const fetch = Effect.fnUntraced(function* (
  client: ArrowFlightClientService,
  options: FetchOptions,
): Effect.fn.Return<Stream.Stream<RecordBatch, WingsError>, never> {
  const schema = arrowSchemaFromProto(ArrowTypeCodec.ArrowSchema.toProto(options.table.schema));
  const currentOffsetRef = yield* Ref.make(options.offset ?? 0n);

  return Stream.fromEffectRepeat(
    Effect.gen(function* () {
      const currentOffset = yield* Ref.get(currentOffsetRef);

      const ticket = createTicket(
        Any.create({
          typeUrl: `type.googleapis.com/${FetchTicket.$type}`,
          value: FetchTicket.encode(
            FetchTicket.create({
              tableName: options.table.name,
              partitionValue: options.partitionValue,
              offset: currentOffset,
              minBatchSize: options.minBatchSize ?? 1,
              maxBatchSize: options.maxBatchSize ?? 100,
            }),
          ).finish(),
        }),
      );

      const batches: RecordBatch[] = yield* client.doGet(ticket, { schema }).pipe(
        Stream.runCollect,
        Effect.map((results) => Array.from(results, ({ batch }) => batch)),
        Effect.mapError(
          (error) =>
            new WingsError({
              message: "Failed to fetch data",
              cause: error,
            }),
        ),
      );

      if (batches.length > 0) {
        const lastBatch = batches[batches.length - 1];
        const offsetColumn = lastBatch.getChild("__offset__");
        if (offsetColumn && offsetColumn.length > 0) {
          const lastOffset = offsetColumn.get(offsetColumn.length - 1);
          yield* Ref.update(currentOffsetRef, (_offset) => lastOffset + 1n);
        }
      }

      return batches;
    }),
  ).pipe(Stream.flatMap((batches) => Stream.fromIterable(batches)));
});
