import { Cause, Data, Duration, Effect, Layer, Metric, Option, Schedule, Stream } from "effect";

import type { KubernetesError } from "../errors";
import type { CustomResource, KubernetesObjectShape, ResourceKey } from "./resource";

import * as Kubernetes from "../client";
import * as Coalesce from "./coalesce";
import * as Reconcile from "./reconcile";
import { keyOf } from "./resource";

/** Additional stream of resource keys that may need reconciliation. */
export interface Source<R> {
  readonly name: string;
  readonly stream: Stream.Stream<ResourceKey, unknown, R>;
}

/** Creates a named controller source. Failures and unexpected completion are retried. */
export const source = <E, R>(
  name: string,
  stream: Stream.Stream<ResourceKey, E, R>,
): Source<R> => ({ name, stream });

/** Configuration for a level-triggered custom resource controller. */
export interface ControllerOptions<A extends KubernetesObjectShape, E, R, RS = never> {
  readonly name: string;
  readonly resource: CustomResource<A>;
  /** Limits the primary watch and resync to one namespace. */
  readonly namespace?: string;
  /** Required safety-net interval for relisting every primary resource. */
  readonly resyncInterval: Duration.Input;
  /** Maximum number of different keys reconciled concurrently. Defaults to one. */
  readonly concurrency?: number;
  /** Reconciles from live state; event payloads are intentionally not provided. */
  readonly reconcile: (key: ResourceKey) => Effect.Effect<Reconcile.Result, E, R>;
  /** Retry policy for one reconciliation before `onGiveUp`. */
  readonly retrySchedule?: Schedule.Schedule<unknown, E>;
  /** Handles exhausted typed failures. Defects and interruption remain crash-loud. */
  readonly onGiveUp: (key: ResourceKey, cause: Cause.Cause<E>) => Effect.Effect<void, never, R>;
  /** Secondary Kubernetes watches or external key streams. */
  readonly sources?: ReadonlyArray<Source<RS>>;
}

class SourceEnded extends Data.TaggedError("SourceEnded")<{
  readonly source: string;
}> {}

const defaultReconcileRetry = Schedule.exponential("250 millis").pipe(
  Schedule.jittered,
  Schedule.both(Schedule.recurs(5)),
);

const transientRetry = Schedule.exponential("1 second").pipe(
  Schedule.jittered,
  Schedule.either(Schedule.spaced("30 seconds")),
);

/** Runs the foreground controller until interrupted. Watches and resyncs reconnect indefinitely. */
export const make = <A extends KubernetesObjectShape, E, R, RS = never>(
  options: ControllerOptions<A, E, R, RS>,
): Effect.Effect<void, Cause.IllegalArgumentError, Kubernetes.Kubernetes | R | RS> =>
  Effect.scoped(
    Effect.gen(function* () {
      const metrics = makeMetrics(options.name);
      const resyncInterval = yield* Effect.try({
        try: () => Duration.fromInputUnsafe(options.resyncInterval),
        catch: () => new Cause.IllegalArgumentError("resyncInterval must be positive and finite"),
      }).pipe(
        Effect.filterOrFail(
          (duration) => Duration.isPositive(duration) && Duration.isFinite(duration),
          () => new Cause.IllegalArgumentError("resyncInterval must be positive and finite"),
        ),
      );
      const coalescer = yield* Coalesce.make({
        concurrency: options.concurrency,
        run: (key) => runReconcile(options, metrics, key),
      });

      yield* Effect.logInfo("Kubernetes controller started").pipe(
        Effect.annotateLogs({
          concurrency: options.concurrency ?? 1,
          resyncInterval: Duration.format(resyncInterval),
        }),
      );
      yield* Effect.addFinalizer(() => Effect.logInfo("Kubernetes controller stopped"));

      const feeds = [
        watchFeed(options, metrics, coalescer),
        resyncFeed(options, metrics, coalescer, resyncInterval),
        ...(options.sources ?? []).map((source) => sourceFeed(source, metrics, coalescer)),
        coalescer.awaitFailure,
      ];
      yield* Effect.all(feeds, { concurrency: "unbounded", discard: true });
    }).pipe(
      Effect.annotateLogs({
        controller: options.name,
        resource: `${options.resource.group}/${options.resource.version}/${options.resource.plural}`,
        namespace: options.namespace ?? "all",
      }),
    ),
  );

/**
 * Runs the controller as a daemon in the Layer scope.
 * Use `make` when the controller is the foreground process.
 */
export const layer = <A extends KubernetesObjectShape, E, R, RS = never>(
  options: ControllerOptions<A, E, R, RS>,
): Layer.Layer<never, Cause.IllegalArgumentError, Kubernetes.Kubernetes | R | RS> =>
  Layer.effectDiscard(Effect.forkScoped(make(options)));

const runReconcile = <A extends KubernetesObjectShape, E, R, RS>(
  options: ControllerOptions<A, E, R, RS>,
  metrics: Metrics,
  key: ResourceKey,
): Effect.Effect<Coalesce.RunResult, never, R> => {
  const retrySchedule = options.retrySchedule ?? defaultReconcileRetry;

  return Effect.logDebug("Reconcile started").pipe(
    Effect.andThen(options.reconcile(key)),
    Effect.tapError((error) => Effect.logDebug("Reconcile attempt failed", error)),
    Effect.withSpan(`${options.name}.reconcile`, {
      attributes: {
        "k8s.namespace": key.namespace ?? "",
        "k8s.name": key.name,
      },
    }),
    Effect.trackDuration(metrics.reconcileDuration),
    Effect.retry(retrySchedule),
    Effect.tap((result) =>
      Metric.update(metrics.reconcilesSuccess, 1).pipe(
        Effect.andThen(
          result._tag === "RequeueAfter"
            ? Effect.logInfo("Reconcile completed; requeue scheduled").pipe(
                Effect.annotateLogs({ requeueAfter: Duration.format(result.delay) }),
              )
            : Effect.logInfo("Reconcile completed"),
        ),
      ),
    ),
    Effect.catchCauseIf(
      (cause) => Cause.hasFails(cause) && !Cause.hasDies(cause) && !Cause.hasInterrupts(cause),
      (cause) =>
        Effect.logWarning("Reconcile failed after exhausting retries", cause).pipe(
          Effect.andThen(options.onGiveUp(key, cause)),
          Effect.andThen(Metric.update(metrics.reconcilesGiveUp, 1)),
          Effect.as(Reconcile.complete),
        ),
    ),
    Effect.orDie,
    Effect.map((result) => (result._tag === "RequeueAfter" ? { requeueAfter: result.delay } : {})),
    Effect.annotateLogs({
      namespace: key.namespace ?? "",
      name: key.name,
    }),
  );
};

const watchFeed = <A extends KubernetesObjectShape, E, R, RS>(
  options: ControllerOptions<A, E, R, RS>,
  metrics: Metrics,
  coalescer: Coalesce.Coalescer,
): Effect.Effect<void, never, Kubernetes.Kubernetes> =>
  Kubernetes.watchCustomObjects<A>(
    {
      group: options.resource.group,
      version: options.resource.version,
      plural: options.resource.plural,
      namespaced: options.resource.namespaced,
    },
    options.namespace,
  ).pipe(
    Stream.runForEach((event) =>
      keyOf(event.object).pipe(
        Option.match({
          onNone: () =>
            Effect.logWarning("Watch event ignored because object metadata has no name"),
          onSome: (key) =>
            coalescer.offer(key).pipe(
              Effect.andThen(Effect.logDebug("Watch event queued for reconciliation")),
              Effect.annotateLogs({
                eventType: event.type,
                namespace: key.namespace ?? "",
                name: key.name,
              }),
            ),
        }),
      ),
    ),
    Effect.tapError((error) =>
      Metric.update(metrics.watchRestarts, 1).pipe(
        Effect.andThen(Effect.logWarning("Kubernetes watch failed; reconnecting", error)),
      ),
    ),
    Effect.retry(transientRetry),
    Effect.orDie,
  );

const sourceFeed = <R>(
  source: Source<R>,
  metrics: Metrics,
  coalescer: Coalesce.Coalescer,
): Effect.Effect<void, never, R> =>
  source.stream.pipe(
    Stream.runForEach((key) =>
      coalescer.offer(key).pipe(
        Effect.andThen(Effect.logDebug("Source event queued for reconciliation")),
        Effect.annotateLogs({
          source: source.name,
          namespace: key.namespace ?? "",
          name: key.name,
        }),
      ),
    ),
    Effect.andThen(Effect.fail(new SourceEnded({ source: source.name }))),
    Effect.tapError((error) =>
      Metric.update(Metric.withAttributes(metrics.sourceRestarts, { source: source.name }), 1).pipe(
        Effect.andThen(
          Effect.logWarning("Controller source stopped; reconnecting", error).pipe(
            Effect.annotateLogs({ source: source.name }),
          ),
        ),
      ),
    ),
    Effect.retry(transientRetry),
    Effect.orDie,
  );

const resyncFeed = <A extends KubernetesObjectShape, E, R, RS>(
  options: ControllerOptions<A, E, R, RS>,
  metrics: Metrics,
  coalescer: Coalesce.Coalescer,
  resyncInterval: Duration.Duration,
): Effect.Effect<void, never, Kubernetes.Kubernetes> =>
  Effect.gen(function* () {
    yield* Effect.sleep(resyncInterval);
    yield* Effect.gen(function* () {
      yield* Metric.update(metrics.resyncs, 1);
      yield* Effect.logDebug("Kubernetes resync started");

      const objects = yield* listRaw(options.resource, options.namespace);
      for (const object of objects) {
        const key = keyOf(object);
        if (Option.isSome(key)) yield* coalescer.offer(key.value);
      }
      yield* Effect.logDebug("Kubernetes resync completed").pipe(
        Effect.annotateLogs({ objects: objects.length }),
      );
    }).pipe(
      Effect.tapError((error) => Effect.logWarning("Kubernetes resync failed; retrying", error)),
      Effect.retry(transientRetry),
    );
  }).pipe(Effect.forever, Effect.orDie);

const listRaw = <A extends KubernetesObjectShape>(
  resource: CustomResource<A>,
  namespace?: string,
): Effect.Effect<ReadonlyArray<KubernetesObjectShape>, KubernetesError, Kubernetes.Kubernetes> => {
  if (resource.namespaced) {
    return namespace === undefined
      ? Kubernetes.listCustomObjectForAllNamespaces<KubernetesObjectShape>({
          group: resource.group,
          version: resource.version,
          plural: resource.plural,
        }).pipe(Effect.map((list) => list.items))
      : Kubernetes.listNamespacedCustomObject<KubernetesObjectShape>({
          group: resource.group,
          version: resource.version,
          namespace,
          plural: resource.plural,
        }).pipe(Effect.map((list) => list.items));
  }

  return Kubernetes.listClusterCustomObject<KubernetesObjectShape>({
    group: resource.group,
    version: resource.version,
    plural: resource.plural,
  }).pipe(Effect.map((list) => list.items));
};

interface Metrics {
  readonly reconcilesSuccess: Metric.Counter<number>;
  readonly reconcilesGiveUp: Metric.Counter<number>;
  readonly reconcileDuration: Metric.Histogram<Duration.Duration>;
  readonly resyncs: Metric.Counter<number>;
  readonly watchRestarts: Metric.Counter<number>;
  readonly sourceRestarts: Metric.Counter<number>;
}

const makeMetrics = (controller: string): Metrics => ({
  reconcilesSuccess: Metric.counter("operator_reconciles_success_total", {
    incremental: true,
    attributes: { controller },
  }),
  reconcilesGiveUp: Metric.counter("operator_reconciles_giveup_total", {
    incremental: true,
    attributes: { controller },
  }),
  reconcileDuration: Metric.timer("operator_reconcile_duration", {
    attributes: { controller },
  }),
  resyncs: Metric.counter("operator_resyncs_total", {
    incremental: true,
    attributes: { controller },
  }),
  watchRestarts: Metric.counter("operator_watch_restarts_total", {
    incremental: true,
    attributes: { controller },
  }),
  sourceRestarts: Metric.counter("operator_source_restarts_total", {
    incremental: true,
    attributes: { controller },
  }),
});
