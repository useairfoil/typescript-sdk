import { Publisher } from "@useairfoil/connector-kit";
import { Deferred, Effect, Layer, Ref } from "effect";

export type Published = {
  readonly resource: string;
  readonly source: Publisher.PublishSource;
  readonly batch: Publisher.ResourceBatch;
};

export const makeTestPublisher = (expected: number) =>
  Effect.gen(function* () {
    const publishedRef = yield* Ref.make<ReadonlyArray<Published>>([]);
    const done = yield* Deferred.make<number, never>();
    const layer = Layer.succeed(Publisher.Publisher)({
      publish: ({ resource, source, batch }) =>
        Effect.gen(function* () {
          const next = yield* Ref.updateAndGet(publishedRef, (items) => [
            ...items,
            { resource, source, batch },
          ]);
          if (next.length >= expected) {
            yield* Deferred.succeed(done, next.length);
          }
          return { status: "accepted" as const, resource };
        }),
    });

    return { publishedRef, done, layer };
  });
