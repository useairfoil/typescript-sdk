import type { ArrowFlightClientService, PutResult } from "@useairfoil/flight";

import { describe, expect, it } from "@effect/vitest";
import { Effect, Fiber } from "effect";

import type { Cluster } from "../src";

import { WingsError } from "../src";
import { makePublisher } from "../src/data-plane/publisher";
import * as PartitionValue from "../src/utils/partition-value";
import { makeTestBatch } from "./helpers";

const table = (partitioned = false): Cluster.Table.Table => ({
  name: "namespaces/default/tables/products",
  schema: {
    fields: [
      { name: "my_field", id: 1n, arrowType: { _tag: "int32" }, nullable: false, metadata: {} },
      { name: "version", id: 2n, arrowType: { _tag: "int32" }, nullable: false, metadata: {} },
      ...(partitioned
        ? [
            {
              name: "my_part",
              id: 3n,
              arrowType: { _tag: "int32" as const },
              nullable: false,
              metadata: {},
            },
          ]
        : []),
    ],
    metadata: {},
  },
  keyFieldId: 1n,
  versionFieldId: 2n,
  partitionFieldId: partitioned ? 3n : undefined,
  targetFreshnessSeconds: 60n,
});

const clientWithResponses = (
  next: () => Promise<IteratorResult<PutResult>>,
): ArrowFlightClientService =>
  ({
    doPut: () => ({
      [Symbol.asyncIterator]: () => ({ next }),
    }),
  }) as unknown as ArrowFlightClientService;

describe("Wings publisher lifecycle", () => {
  it.effect("keeps invalid partition configuration in the typed error channel", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const client = clientWithResponses(() => new Promise(() => undefined));
        const error = yield* makePublisher(client, {
          table: table(true),
          partitionValue: PartitionValue.string("wrong-type"),
        }).pipe(Effect.flip);

        expect(error).toBeInstanceOf(WingsError);
      }),
    ),
  );

  it.effect("fails pending and future pushes when the response stream fails", () =>
    Effect.scoped(
      Effect.gen(function* () {
        let rejectResponse!: (cause: unknown) => void;
        const response = new Promise<IteratorResult<PutResult>>((_, reject) => {
          rejectResponse = reject;
        });
        const publisher = yield* makePublisher(
          clientWithResponses(() => response),
          {
            table: table(),
          },
        );

        const pushFiber = yield* publisher.push({ batch: makeTestBatch() }).pipe(Effect.forkScoped);
        yield* Effect.yieldNow;
        rejectResponse(new Error("stream unavailable"));

        const pendingError = yield* Fiber.join(pushFiber).pipe(Effect.flip);
        const futureError = yield* publisher.push({ batch: makeTestBatch() }).pipe(Effect.flip);

        expect(pendingError).toBeInstanceOf(WingsError);
        expect(futureError).toBeInstanceOf(WingsError);
      }),
    ),
  );
});
