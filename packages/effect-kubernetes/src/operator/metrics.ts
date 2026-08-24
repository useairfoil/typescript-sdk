import { type Duration, Metric } from "effect";

/** Stable attributes used by operator metrics. */
export const Attr = {
  controllerName: "airfoil.operator.controller.name",
  sourceName: "airfoil.operator.source.name",
} as const;

/** Instruments scoped to one controller runtime. */
export interface Metrics {
  readonly reconcilesSuccess: Metric.Counter<number>;
  readonly reconcilesGiveUp: Metric.Counter<number>;
  readonly reconcileDuration: Metric.Histogram<Duration.Duration>;
  readonly resyncs: Metric.Counter<number>;
  readonly watchRestarts: Metric.Counter<number>;
  readonly sourceRestarts: Metric.Counter<number>;
}

/** @internal Metrics owned by one controller runtime. */
export const make = (controller: string): Metrics => ({
  reconcilesSuccess: Metric.counter("airfoil.operator.reconcile.successes", {
    incremental: true,
    attributes: { [Attr.controllerName]: controller, unit: "{reconcile}" },
  }),
  reconcilesGiveUp: Metric.counter("airfoil.operator.reconcile.retry_exhaustions", {
    incremental: true,
    attributes: { [Attr.controllerName]: controller, unit: "{reconcile}" },
  }),
  reconcileDuration: Metric.timer("airfoil.operator.reconcile.duration", {
    attributes: { [Attr.controllerName]: controller, unit: "ms" },
  }),
  resyncs: Metric.counter("airfoil.operator.resyncs", {
    incremental: true,
    attributes: { [Attr.controllerName]: controller, unit: "{resync}" },
  }),
  watchRestarts: Metric.counter("airfoil.operator.watch.restarts", {
    incremental: true,
    attributes: { [Attr.controllerName]: controller, unit: "{restart}" },
  }),
  sourceRestarts: Metric.counter("airfoil.operator.source.restarts", {
    incremental: true,
    attributes: { [Attr.controllerName]: controller, unit: "{restart}" },
  }),
});
