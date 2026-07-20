import { describe, expect, it } from "@effect/vitest";
import { Deferred, Effect, Fiber, Queue, Ref, Schedule, Stream } from "effect";
import { TestClock } from "effect/testing";

import { KubernetesError } from "../src";
import { Controller, Reconcile, Resource } from "../src/operator";
import { makeFake } from "../src/testing";

const TestGvr = {
  group: "example.com",
  version: "v1",
  plural: "tests",
  namespaced: true,
} as const;

const TestResource = Resource.custom({ ...TestGvr, kind: "Test" });

describe("Controller", () => {
  it.effect("reconciles keys from watch events", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const fake = yield* makeFake();
        const reconciled = yield* Deferred.make<Resource.ResourceKey>();

        yield* Controller.make({
          name: "test-controller",
          resource: TestResource,
          resyncInterval: "1 hour",
          reconcile: (key) => Deferred.succeed(reconciled, key).pipe(Effect.as(Reconcile.complete)),
          onGiveUp: () => Effect.void,
        }).pipe(Effect.provide(fake.layer), Effect.forkScoped);

        yield* fake.awaitWatch;
        yield* fake.emit(TestGvr, {
          type: "Modified",
          object: { metadata: { namespace: "default", name: "one" } },
        });
        expect(yield* Deferred.await(reconciled)).toEqual({ namespace: "default", name: "one" });
      }),
    ),
  );

  it.effect("reconciles keys from resync", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const fake = yield* makeFake();
        const reconciled = yield* Deferred.make<Resource.ResourceKey>();
        yield* fake.put(
          { group: "example.com", version: "v1", plural: "tests", namespaced: true },
          { metadata: { namespace: "default", name: "one" } },
        );

        yield* Controller.make({
          name: "test-controller",
          resource: TestResource,
          resyncInterval: "1 second",
          reconcile: (key) => Deferred.succeed(reconciled, key).pipe(Effect.as(Reconcile.complete)),
          onGiveUp: () => Effect.void,
        }).pipe(Effect.provide(fake.layer), Effect.forkScoped);

        yield* TestClock.adjust("1 second");
        expect(yield* Deferred.await(reconciled)).toEqual({ namespace: "default", name: "one" });
      }),
    ),
  );

  it.effect("retries typed reconcile errors, gives up, then starts a fresh budget", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const fake = yield* makeFake();
        const attempts = yield* Ref.make(0);
        const giveUps = yield* Ref.make(0);
        const giveUpEvents = yield* Queue.unbounded<void>();

        yield* Controller.make({
          name: "test-controller",
          resource: TestResource,
          resyncInterval: "1 hour",
          retrySchedule: Schedule.recurs(1),
          reconcile: () =>
            Ref.update(attempts, (n) => n + 1).pipe(Effect.andThen(Effect.fail("bad"))),
          onGiveUp: () =>
            Ref.update(giveUps, (n) => n + 1).pipe(
              Effect.andThen(Queue.offer(giveUpEvents, undefined)),
            ),
        }).pipe(Effect.provide(fake.layer), Effect.forkScoped);

        yield* fake.awaitWatch;
        yield* fake.emit(TestGvr, {
          type: "Modified",
          object: { metadata: { namespace: "default", name: "one" } },
        });
        yield* Queue.take(giveUpEvents);

        expect(yield* Ref.get(attempts)).toBe(2);
        expect(yield* Ref.get(giveUps)).toBe(1);

        yield* fake.emit(TestGvr, {
          type: "Modified",
          object: { metadata: { namespace: "default", name: "one" } },
        });
        yield* Queue.take(giveUpEvents);

        expect(yield* Ref.get(attempts)).toBe(4);
        expect(yield* Ref.get(giveUps)).toBe(2);
      }),
    ),
  );

  it.effect("does not let one failing key block another key", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const fake = yield* makeFake();
        const completed = yield* Ref.make<ReadonlyArray<string>>([]);
        const giveUps = yield* Ref.make(0);
        const goodCompleted = yield* Deferred.make<void>();
        const badCompleted = yield* Deferred.make<void>();

        yield* Controller.make({
          name: "test-controller",
          resource: TestResource,
          resyncInterval: "1 hour",
          concurrency: 2,
          retrySchedule: Schedule.recurs(0),
          reconcile: (key) =>
            key.name === "bad"
              ? Effect.fail("bad instance")
              : Ref.update(completed, (current) => [...current, key.name]).pipe(
                  Effect.andThen(Deferred.succeed(goodCompleted, undefined)),
                  Effect.as(Reconcile.complete),
                ),
          onGiveUp: () =>
            Ref.update(giveUps, (n) => n + 1).pipe(
              Effect.andThen(Deferred.succeed(badCompleted, undefined)),
            ),
        }).pipe(Effect.provide(fake.layer), Effect.forkScoped);

        yield* fake.awaitWatch;
        yield* fake.emit(TestGvr, {
          type: "Modified",
          object: { metadata: { namespace: "default", name: "bad" } },
        });
        yield* fake.emit(TestGvr, {
          type: "Modified",
          object: { metadata: { namespace: "default", name: "good" } },
        });
        yield* Deferred.await(goodCompleted);
        yield* Deferred.await(badCompleted);

        expect(yield* Ref.get(completed)).toEqual(["good"]);
        expect(yield* Ref.get(giveUps)).toBe(1);
      }),
    ),
  );

  it.effect("reconciles again after RequeueAfter", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const fake = yield* makeFake();
        const runs = yield* Ref.make(0);
        const runEvents = yield* Queue.unbounded<number>();

        yield* Controller.make({
          name: "test-controller",
          resource: TestResource,
          resyncInterval: "1 hour",
          reconcile: () =>
            Ref.updateAndGet(runs, (n) => n + 1).pipe(
              Effect.tap((count) => Queue.offer(runEvents, count)),
              Effect.map((count) =>
                count === 1 ? Reconcile.requeueAfter("1 second") : Reconcile.complete,
              ),
            ),
          onGiveUp: () => Effect.void,
        }).pipe(Effect.provide(fake.layer), Effect.forkScoped);

        yield* fake.awaitWatch;
        yield* fake.emit(TestGvr, {
          type: "Modified",
          object: { metadata: { namespace: "default", name: "one" } },
        });
        expect(yield* Queue.take(runEvents)).toBe(1);

        yield* TestClock.adjust("1 second");
        expect(yield* Queue.take(runEvents)).toBe(2);
      }),
    ),
  );

  it.effect("retries the watch after a watch failure", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const fake = yield* makeFake();
        const reconciled = yield* Deferred.make<Resource.ResourceKey>();

        yield* Controller.make({
          name: "test-controller",
          resource: TestResource,
          resyncInterval: "1 hour",
          reconcile: (key) => Deferred.succeed(reconciled, key).pipe(Effect.as(Reconcile.complete)),
          onGiveUp: () => Effect.void,
        }).pipe(Effect.provide(fake.layer), Effect.forkScoped);

        yield* fake.awaitWatch;
        yield* fake.failWatch(new KubernetesError.KubernetesError({ message: "watch failed" }));
        yield* TestClock.adjust("5 seconds");
        yield* fake.awaitWatch;
        yield* fake.emit(TestGvr, {
          type: "Modified",
          object: { metadata: { namespace: "default", name: "one" } },
        });
        expect(yield* Deferred.await(reconciled)).toEqual({ namespace: "default", name: "one" });
      }),
    ),
  );

  it.effect("reconnects an additional source and reconciles its key", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const fake = yield* makeFake();
        const sourceStarts = yield* Ref.make(0);
        const reconciled = yield* Deferred.make<Resource.ResourceKey>();
        const additionalSource = Stream.unwrap(
          Ref.updateAndGet(sourceStarts, (count) => count + 1).pipe(
            Effect.map((attempt) =>
              attempt === 1
                ? Stream.fail("source unavailable")
                : Stream.make({ namespace: "default", name: "from-source" }).pipe(
                    Stream.concat(Stream.never),
                  ),
            ),
          ),
        );

        yield* Controller.make({
          name: "test-controller",
          resource: TestResource,
          resyncInterval: "1 hour",
          sources: [Controller.source("secondary", additionalSource)],
          reconcile: (key) => Deferred.succeed(reconciled, key).pipe(Effect.as(Reconcile.complete)),
          onGiveUp: () => Effect.void,
        }).pipe(Effect.provide(fake.layer), Effect.forkScoped);

        yield* fake.awaitWatch;
        yield* TestClock.adjust("5 seconds");

        expect(yield* Deferred.await(reconciled)).toEqual({
          namespace: "default",
          name: "from-source",
        });
        expect(yield* Ref.get(sourceStarts)).toBe(2);
      }),
    ),
  );

  it.effect("fails the controller fiber when reconcile defects", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const fake = yield* makeFake();
        yield* fake.put(
          { group: "example.com", version: "v1", plural: "tests", namespaced: true },
          { metadata: { namespace: "default", name: "one" } },
        );

        const fiber = yield* Controller.make({
          name: "test-controller",
          resource: TestResource,
          resyncInterval: "1 second",
          reconcile: () => Effect.die("boom"),
          onGiveUp: () => Effect.void,
        }).pipe(Effect.provide(fake.layer), Effect.forkScoped);

        yield* fake.awaitWatch;
        yield* TestClock.adjust("1 second");
        const exit = yield* Fiber.await(fiber);

        expect(exit._tag).toBe("Failure");
      }),
    ),
  );

  it.effect("does not treat controller interruption as reconcile failure", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const fake = yield* makeFake();
        const reconcileStarted = yield* Deferred.make<void>();
        const giveUps = yield* Ref.make(0);

        const fiber = yield* Controller.make({
          name: "test-controller",
          resource: TestResource,
          resyncInterval: "1 hour",
          reconcile: () =>
            Deferred.succeed(reconcileStarted, undefined).pipe(Effect.andThen(Effect.never)),
          onGiveUp: () => Ref.update(giveUps, (count) => count + 1),
        }).pipe(Effect.provide(fake.layer), Effect.forkScoped);

        yield* fake.awaitWatch;
        yield* fake.emit(TestGvr, {
          type: "Modified",
          object: { metadata: { namespace: "default", name: "one" } },
        });
        yield* Deferred.await(reconcileStarted);
        yield* Fiber.interrupt(fiber);

        expect(yield* Ref.get(giveUps)).toBe(0);
      }),
    ),
  );
});
