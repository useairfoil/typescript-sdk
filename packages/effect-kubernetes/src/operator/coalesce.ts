import { Cause, Duration, Effect, Queue, Ref, Scope } from "effect";

import type { ResourceKey } from "./resource";

/** Optional scheduling request produced after processing one key. */
export interface RunResult {
  readonly requeueAfter?: Duration.Duration;
}

/** A scoped keyed queue used by the controller runtime. */
export interface Coalescer {
  /** Queues a key, or marks it dirty when it is already queued or running. */
  readonly offer: (key: ResourceKey) => Effect.Effect<void>;
  /** Queues a key after a validated delay. */
  readonly offerAfter: (
    key: ResourceKey,
    delay: Duration.Input,
  ) => Effect.Effect<void, Cause.IllegalArgumentError>;
  /** Never completes normally; propagates an unexpected worker defect. */
  readonly awaitFailure: Effect.Effect<never, never>;
}

interface KeyState {
  readonly dirty: boolean;
}

/**
 * Creates a scoped keyed queue that runs at most one effect per key at a time.
 * Repeated offers are collapsed into one follow-up run without dropping the latest signal.
 */
export const make = <R>(options: {
  readonly concurrency?: number;
  readonly run: (key: ResourceKey) => Effect.Effect<RunResult, never, R>;
}): Effect.Effect<Coalescer, Cause.IllegalArgumentError, Scope.Scope | R> =>
  Effect.gen(function* () {
    const concurrency = options.concurrency ?? 1;
    if (!Number.isSafeInteger(concurrency) || concurrency < 1) {
      return yield* new Cause.IllegalArgumentError("concurrency must be a positive integer");
    }
    const scope = yield* Effect.scope;
    const states = yield* Ref.make(new Map<string, KeyState>());
    const queue = yield* Queue.unbounded<ResourceKey>();
    const failures = yield* Queue.unbounded<Cause.Cause<never>>();

    const offer = (key: ResourceKey): Effect.Effect<void> =>
      Ref.modify(states, (current) => {
        const id = keyId(key);
        const next = new Map(current);
        const state = next.get(id);

        if (state !== undefined) {
          next.set(id, { dirty: true });
          return [false, next];
        }

        next.set(id, { dirty: false });
        return [true, next];
      }).pipe(
        Effect.flatMap((shouldStart) => (shouldStart ? Queue.offer(queue, key) : Effect.void)),
        Effect.asVoid,
      );

    const offerAfter = (
      key: ResourceKey,
      delay: Duration.Input,
    ): Effect.Effect<void, Cause.IllegalArgumentError> =>
      Effect.try({
        try: () => Duration.fromInputUnsafe(delay),
        catch: () => new Cause.IllegalArgumentError("delay must be non-negative and finite"),
      }).pipe(
        Effect.filterOrFail(
          (duration) => !Duration.isNegative(duration) && Duration.isFinite(duration),
          () => new Cause.IllegalArgumentError("delay must be non-negative and finite"),
        ),
        Effect.flatMap((duration) =>
          Effect.sleep(duration).pipe(Effect.andThen(offer(key)), Effect.forkIn(scope)),
        ),
        Effect.asVoid,
      );

    const runKey = (key: ResourceKey): Effect.Effect<void, never, R | Scope.Scope> =>
      Effect.gen(function* () {
        const result = yield* options.run(key);
        if (result.requeueAfter !== undefined) {
          yield* offerAfter(key, result.requeueAfter).pipe(Effect.orDie);
        }

        const shouldRunAgain = yield* Ref.modify(states, (current) => {
          const id = keyId(key);
          const state = current.get(id);
          const next = new Map(current);

          if (state?.dirty === true) {
            next.set(id, { dirty: false });
            return [true, next];
          }

          next.delete(id);
          return [false, next];
        });

        if (shouldRunAgain) yield* Queue.offer(queue, key);
      });

    const worker = Queue.take(queue).pipe(
      Effect.flatMap(runKey),
      Effect.forever,
      Effect.catchCause((cause) =>
        Cause.hasDies(cause)
          ? Queue.offer(failures, cause).pipe(Effect.andThen(Effect.never))
          : Effect.void,
      ),
    );

    for (let i = 0; i < concurrency; i++) {
      yield* worker.pipe(Effect.forkScoped);
    }

    const awaitFailure = Queue.take(failures).pipe(Effect.flatMap(Effect.failCause));

    return { offer, offerAfter, awaitFailure };
  });

const keyId = (key: ResourceKey): string => `${key.namespace ?? ""}/${key.name}`;
