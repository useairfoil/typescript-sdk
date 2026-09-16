import type { ResourceBatch } from "@useairfoil/connector-kit";

import { Ingestor } from "@useairfoil/connector-kit";
import { Deferred, Effect, Layer, Ref } from "effect";

export type Ingested = {
  readonly resource: string;
  readonly source: Ingestor.IngestSource;
  readonly batch: ResourceBatch;
};

// Captures ingested batches and resolves `done` after the expected count lands.
export const makeTestIngestor = (expected: number) =>
  Effect.gen(function* () {
    const ingestedRef = yield* Ref.make<ReadonlyArray<Ingested>>([]);
    const done = yield* Deferred.make<number, never>();
    const layer = Layer.succeed(Ingestor.Ingestor)({
      ingest: ({ resource, source, batch }) =>
        Effect.gen(function* () {
          const next = yield* Ref.updateAndGet(ingestedRef, (items) => [
            ...items,
            { resource, source, batch },
          ]);

          if (next.length === expected) {
            yield* Deferred.succeed(done, next.length);
          }
        }),
    });

    return { ingestedRef, done, layer };
  });
