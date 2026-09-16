import { describe, expect, it } from "@effect/vitest";
import { Duration, Effect, Metric } from "effect";
import { PrometheusMetrics } from "effect/unstable/observability";

import { ConnectorError } from "../src/errors";
import { ingestBatch } from "../src/ingestor/instrumented";
import { Ingestor } from "../src/ingestor/service";
import * as Metrics from "../src/metrics";
import { Attr } from "../src/telemetry";

const expectedNames = [
  "airfoil.connector.batches",
  "airfoil.connector.rows.ingested",
  "airfoil.connector.batch.size",
  "airfoil.connector.ingest.duration",
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

      yield* Metric.update(Metric.withAttributes(Metrics.batches, attributes), 1);
      yield* Metric.update(Metric.withAttributes(Metrics.rowsIngested, attributes), 1);
      yield* Metric.update(Metric.withAttributes(Metrics.batchSize, attributes), 1);
      yield* Metric.update(
        Metric.withAttributes(Metrics.ingestDuration, attributes),
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
        snapshot.find((metric) => metric.id === Metrics.ingestDuration.id)?.attributes,
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

  it.effect("counts rows after successful ingestion", () =>
    Effect.gen(function* () {
      yield* ingestBatch({
        connector: "producer-test",
        resource: "products",
        source: "changes",
        batch: { rows: [{ id: "p1" }, { id: "p2" }] },
      });

      const snapshot = yield* Metric.snapshot;
      expect(snapshot.find((metric) => metric.id === Metrics.rowsIngested.id)?.state).toMatchObject(
        { count: 2 },
      );
    }).pipe(
      Effect.provideService(Ingestor, { ingest: () => Effect.void }),
      Effect.provideService(Metric.MetricRegistry, new Map()),
    ),
  );

  it.effect("records ingestion duration when the ingestor fails", () =>
    Effect.gen(function* () {
      yield* ingestBatch({
        connector: "producer-test",
        resource: "products",
        source: "changes",
        batch: { rows: [] },
      }).pipe(Effect.exit);

      const snapshot = yield* Metric.snapshot;
      expect(
        snapshot.find((metric) => metric.id === Metrics.ingestDuration.id)?.state,
      ).toMatchObject({ count: 1 });
      expect(snapshot.find((metric) => metric.id === Metrics.rowsIngested.id)).toBeUndefined();
    }).pipe(
      Effect.provideService(Ingestor, {
        ingest: () => Effect.fail(new ConnectorError({ message: "ingestion failed" })),
      }),
      Effect.provideService(Metric.MetricRegistry, new Map()),
    ),
  );
});
