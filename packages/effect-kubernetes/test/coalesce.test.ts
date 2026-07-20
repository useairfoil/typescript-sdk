import { describe, expect, it } from "@effect/vitest";
import { Deferred, Effect, Ref } from "effect";
import { TestClock } from "effect/testing";

import { Coalesce } from "../src/operator";

describe("Coalesce", () => {
  it.effect("collapses duplicate offers while a key is running", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const runs = yield* Ref.make(0);
        const firstStarted = yield* Deferred.make<void>();
        const releaseFirst = yield* Deferred.make<void>();

        const coalescer = yield* Coalesce.make({
          run: () =>
            Effect.gen(function* () {
              const count = yield* Ref.updateAndGet(runs, (n) => n + 1);
              if (count === 1) {
                yield* Deferred.succeed(firstStarted, void 0);
                yield* Deferred.await(releaseFirst);
              }
              return {};
            }),
        });

        yield* coalescer.offer({ namespace: "default", name: "one" });
        yield* Deferred.await(firstStarted);
        yield* coalescer.offer({ namespace: "default", name: "one" });
        yield* coalescer.offer({ namespace: "default", name: "one" });
        yield* Deferred.succeed(releaseFirst, void 0);
        yield* TestClock.adjust("1 millis");

        expect(yield* Ref.get(runs)).toBe(2);
      }),
    ),
  );

  it.effect("offers after a delay", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const runs = yield* Ref.make(0);
        const coalescer = yield* Coalesce.make({
          run: () => Ref.update(runs, (n) => n + 1).pipe(Effect.as({})),
        });

        yield* coalescer.offerAfter({ namespace: "default", name: "one" }, "1 second");
        expect(yield* Ref.get(runs)).toBe(0);
        yield* TestClock.adjust("1 second");
        yield* TestClock.adjust("1 millis");

        expect(yield* Ref.get(runs)).toBe(1);
      }),
    ),
  );

  it.effect("moves a dirty key behind other queued keys", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const order = yield* Ref.make<ReadonlyArray<string>>([]);
        const hotStarted = yield* Deferred.make<void>();
        const releaseHot = yield* Deferred.make<void>();
        const allFinished = yield* Deferred.make<void>();
        const coalescer = yield* Coalesce.make({
          concurrency: 1,
          run: (key) =>
            Effect.gen(function* () {
              const current = yield* Ref.updateAndGet(order, (current) => [...current, key.name]);
              if (key.name === "hot" && current.length === 1) {
                yield* Deferred.succeed(hotStarted, void 0);
                yield* Deferred.await(releaseHot);
              }
              if (current.length === 3) yield* Deferred.succeed(allFinished, void 0);
              return {};
            }),
        });

        yield* coalescer.offer({ namespace: "default", name: "hot" });
        yield* Deferred.await(hotStarted);
        yield* coalescer.offer({ namespace: "default", name: "cold" });
        yield* coalescer.offer({ namespace: "default", name: "hot" });
        yield* Deferred.succeed(releaseHot, void 0);
        yield* Deferred.await(allFinished);

        expect(yield* Ref.get(order)).toEqual(["hot", "cold", "hot"]);
      }),
    ),
  );
});
