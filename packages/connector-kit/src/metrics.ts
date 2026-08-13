import { DateTime, Effect, Metric, Option } from "effect";

import type { SyncState } from "./core/types";

export type BatchSource = "backfill" | "changes" | "webhook";
export type BatchOutcome = "accepted" | "rejected" | "error";
export type ApiRetryReason = "transport" | "timeout" | "rate_limit" | "server_error";
export type WebhookOutcome =
  | "ok"
  | "read_error"
  | "invalid_json"
  | "invalid_payload"
  | "rejected"
  | "handler_error";

export type ResourceMetricAttrs = {
  readonly connector: string;
  readonly resource: string;
  readonly source: BatchSource;
};

export type WebhookMetricAttrs = {
  readonly connector: string;
  readonly path: string;
  readonly outcome: WebhookOutcome;
};

export type SyncStateAttrs = {
  readonly connector: string;
  readonly resource: string;
};

export type LastSuccessMetricAttrs = {
  readonly connector: string;
  readonly resource: string;
  readonly source: "backfill" | "changes";
};

export type ApiRetryMetricAttrs = {
  readonly connector: string;
  readonly reason: ApiRetryReason;
};

export const entitiesUpsertedTotal = Metric.counter("airfoil_connector_entities_upserted_total", {
  description: "Total entity upsert mutations published by connector sources",
  incremental: true,
});

export const entitiesDeletedTotal = Metric.counter("airfoil_connector_entities_deleted_total", {
  description: "Total entity delete mutations published by connector sources",
  incremental: true,
});

export const batchesTotal = Metric.counter("airfoil_connector_batches_total", {
  description: "Total resource batches published by connector sources",
  incremental: true,
});

export const batchSize = Metric.histogram("airfoil_connector_batch_size", {
  description: "Distribution of resource mutation batch sizes",
  boundaries: [1, 5, 10, 25, 50, 100, 250, 500, 1000],
});

export const publishDuration = Metric.timer("airfoil_connector_publish_duration_ms", {
  description: "Publisher call duration in milliseconds",
  boundaries: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
});

export const webhookRequestsTotal = Metric.counter("airfoil_connector_webhook_requests_total", {
  description: "Total webhook HTTP requests handled by connector routes",
  incremental: true,
});

export const webhookQueueDepth = Metric.gauge("airfoil_connector_webhook_queue_depth", {
  description: "Current queued webhook batches waiting for publish",
});

export const syncState = Metric.gauge("airfoil_connector_sync_state", {
  description: "Connector resource sync state as a Prometheus state-set gauge",
});

export const lastSuccessTimestamp = Metric.gauge(
  "airfoil_connector_last_success_timestamp_seconds",
  {
    description: "Unix timestamp of the last successful durable source checkpoint",
  },
);

export const apiRetriesTotal = Metric.counter("airfoil_connector_api_retries_total", {
  description: "Total provider API retries performed by the connector",
  incremental: true,
});

export const recordWebhookRequest = (attrs: WebhookMetricAttrs) =>
  Metric.update(Metric.withAttributes(webhookRequestsTotal, attrs), 1);

export const setWebhookQueueDepth = (connector: string, depth: number) =>
  Metric.update(Metric.withAttributes(webhookQueueDepth, { connector }), depth);

export const setLastSuccessTimestamp = (attrs: LastSuccessMetricAttrs, lastSuccessAt?: string) => {
  const timestamp =
    lastSuccessAt === undefined
      ? 0
      : DateTime.make(lastSuccessAt).pipe(
          Option.map((dateTime) => DateTime.toEpochMillis(dateTime) / 1000),
          Option.getOrElse(() => 0),
        );
  return Metric.update(Metric.withAttributes(lastSuccessTimestamp, attrs), timestamp);
};

export const recordApiRetry = (attrs: ApiRetryMetricAttrs) =>
  Metric.update(Metric.withAttributes(apiRetriesTotal, attrs), 1);

const syncStates = ["pending", "backfilling", "live", "error"] as const;

export const setSyncState = (attrs: SyncStateAttrs, current: SyncState) =>
  Effect.forEach(
    syncStates,
    (state) =>
      Metric.update(
        Metric.withAttributes(syncState, {
          ...attrs,
          state,
        }),
        state === current ? 1 : 0,
      ),
    { discard: true },
  );
