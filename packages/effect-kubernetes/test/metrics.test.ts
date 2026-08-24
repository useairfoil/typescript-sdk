import { describe, expect, it } from "@effect/vitest";
import { Duration, Effect, Metric } from "effect";
import { PrometheusMetrics } from "effect/unstable/observability";

import * as OperatorMetrics from "../src/operator/metrics";

const expectedNames = [
  "airfoil.operator.reconcile.successes",
  "airfoil.operator.reconcile.retry_exhaustions",
  "airfoil.operator.reconcile.duration",
  "airfoil.operator.resyncs",
  "airfoil.operator.watch.restarts",
  "airfoil.operator.source.restarts",
] as const;

describe("operator metrics", () => {
  it.effect("uses canonical OTel names, units, attributes, and Prometheus sanitization", () =>
    Effect.gen(function* () {
      const metrics = OperatorMetrics.make("connector-operator");
      yield* Metric.update(metrics.reconcilesSuccess, 1);
      yield* Metric.update(metrics.reconcilesGiveUp, 1);
      yield* Metric.update(metrics.reconcileDuration, Duration.millis(5));
      yield* Metric.update(metrics.resyncs, 1);
      yield* Metric.update(metrics.watchRestarts, 1);
      yield* Metric.update(
        Metric.withAttributes(metrics.sourceRestarts, {
          [OperatorMetrics.Attr.sourceName]: "axiom",
        }),
        1,
      );

      const snapshot = yield* Metric.snapshot;
      expect(new Set(snapshot.map((metric) => metric.id))).toEqual(new Set(expectedNames));
      expect(
        snapshot.every(
          (metric) =>
            metric.attributes?.[OperatorMetrics.Attr.controllerName] === "connector-operator",
        ),
      ).toBe(true);
      expect(
        snapshot.find((metric) => metric.id === metrics.sourceRestarts.id)?.attributes?.[
          OperatorMetrics.Attr.sourceName
        ],
      ).toBe("axiom");

      const prometheus = yield* PrometheusMetrics.format();
      for (const name of expectedNames) {
        expect(prometheus).toContain(name.replaceAll(".", "_"));
      }
      expect(prometheus).not.toContain("_total");
    }).pipe(Effect.provideService(Metric.MetricRegistry, new Map())),
  );
});
