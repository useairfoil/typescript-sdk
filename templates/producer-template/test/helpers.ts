import type { Batch } from "@useairfoil/connector-kit";

import { Publisher } from "@useairfoil/connector-kit";
import { Deferred, Effect, Layer, Ref } from "effect";

export type Published = {
  readonly name: string;
  readonly source: "live" | "backfill";
  readonly batch: Batch<Record<string, unknown>>;
};

// Layers a `Publisher` service that captures each publish into a Ref and
// resolves `done` after `expected` batches land. Tests use `Deferred.await(done)`
// to synchronize on ingestion completion.
export const makeTestPublisher = (expected: number) =>
  Effect.gen(function* () {
    const publishedRef = yield* Ref.make<ReadonlyArray<Published>>([]);
    const done = yield* Deferred.make<number, never>();
    const layer = Layer.succeed(Publisher)({
      publish: ({ name, source, batch }) =>
        Effect.gen(function* () {
          const next = yield* Ref.updateAndGet(publishedRef, (items) => [
            ...items,
            { name, source, batch },
          ]);
          if (next.length === expected) {
            yield* Deferred.succeed(done, next.length);
          }
          return { success: true };
        }),
    });

    return { publishedRef, done, layer };
  });
