import { describe, expect, it } from "@effect/vitest";
import { Duration, Effect, Metric } from "effect";
import { PrometheusMetrics } from "effect/unstable/observability";

import { ConnectorError } from "../src/errors";
import * as Metrics from "../src/metrics";
import { publishBatch } from "../src/publisher/instrumented";
import { Publisher } from "../src/publisher/service";
import { Attr } from "../src/telemetry";

const expectedNames = [
  "airfoil.connector.entity.upserts",
  "airfoil.connector.entity.deletes",
  "airfoil.connector.batches",
  "airfoil.connector.batch.size",
  "airfoil.connector.publish.duration",
  "airfoil.connector.webhook.requests",
  "airfoil.connector.webhook.queue.depth",
  "airfoil.connector.sync.state",
  "airfoil.connector.last_success.timestamp",
  "airfoil.connector.api.retries",
] as const;

describe("connector metrics", () => {
  it.effect("uses canonical OTel names, units, attributes, and Prometheus sanitization", () =>
    Effect.gen(function* () {
      const resource = {
        connector: "producer-test",
        resource: "products",
        source: "changes" as const,
      };
      const attributes = Metrics.withResourceAttributes(resource);

      yield* Metric.update(Metric.withAttributes(Metrics.entitiesUpserted, attributes), 1);
      yield* Metric.update(Metric.withAttributes(Metrics.entitiesDeleted, attributes), 1);
      yield* Metric.update(Metric.withAttributes(Metrics.batches, attributes), 1);
      yield* Metric.update(Metric.withAttributes(Metrics.batchSize, attributes), 1);
      yield* Metric.update(
        Metric.withAttributes(Metrics.publishDuration, attributes),
        Duration.millis(5),
      );
      yield* Metrics.recordWebhookRequest({
        connector: "producer-test",
        path: "/webhooks/test",
        outcome: "ok",
      });
      yield* Metrics.setWebhookQueueDepth("producer-test", 1);
      yield* Metrics.setSyncState({ connector: "producer-test", resource: "products" }, "live");
      yield* Metrics.setLastSuccessTimestamp(resource, "2026-01-01T00:00:00.000Z");
      yield* Metrics.recordApiRetry({ connector: "producer-test", reason: "timeout" });

      const snapshot = yield* Metric.snapshot;
      expect(new Set(snapshot.map((metric) => metric.id))).toEqual(new Set(expectedNames));
      expect(
        snapshot.find((metric) => metric.id === Metrics.publishDuration.id)?.attributes,
      ).toEqual(expect.objectContaining({ unit: "ms" }));
      expect(
        snapshot.find((metric) => metric.id === Metrics.lastSuccessTimestamp.id)?.attributes,
      ).toEqual(expect.objectContaining({ unit: "s" }));
      expect(
        snapshot.some((metric) => metric.attributes?.[Attr.connectorName] === "producer-test"),
      ).toBe(true);
      expect(snapshot.some((metric) => metric.attributes?.[Attr.resourceName] === "products")).toBe(
        true,
      );
      expect(
        snapshot.some((metric) => metric.attributes?.[Attr.apiRetryReason] === "timeout"),
      ).toBe(true);

      const prometheus = yield* PrometheusMetrics.format();
      for (const name of expectedNames) {
        expect(prometheus).toContain(name.replaceAll(".", "_"));
      }
      expect(prometheus).toContain('airfoil_connector_name="producer-test"');
      expect(prometheus).not.toContain("_total");
    }).pipe(Effect.provideService(Metric.MetricRegistry, new Map())),
  );

  it.effect("records publish duration when the publisher fails", () =>
    Effect.gen(function* () {
      yield* publishBatch({
        connector: "producer-test",
        resource: "products",
        source: "changes",
        batch: { mutations: [] },
      }).pipe(Effect.exit);

      const snapshot = yield* Metric.snapshot;
      expect(
        snapshot.find((metric) => metric.id === Metrics.publishDuration.id)?.state,
      ).toMatchObject({ count: 1 });
    }).pipe(
      Effect.provideService(Publisher, {
        publish: () => Effect.fail(new ConnectorError({ message: "publish failed" })),
      }),
      Effect.provideService(Metric.MetricRegistry, new Map()),
    ),
  );
});
