import {
  Cause,
  DateTime,
  type Duration,
  Effect,
  Metric,
  Option,
  Predicate,
  Schedule,
} from "effect";
import { HttpClientError, HttpClientResponse } from "effect/http";

import type { SyncState } from "./core/types";

import { Attr } from "./telemetry";

export type BatchSource = "backfill" | "changes" | "webhook";
export type BatchOutcome = "success" | "error";
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

export const batches = Metric.counter("airfoil.connector.batches", {
  description: "Total resource batches ingested by connector sources",
  incremental: true,
  attributes: { unit: "{batch}" },
});

export const rowsIngested = Metric.counter("airfoil.connector.rows.ingested", {
  description: "Total resource rows successfully ingested",
  incremental: true,
  attributes: { unit: "{row}" },
});

export const batchSize = Metric.histogram("airfoil.connector.batch.size", {
  description: "Distribution of resource row batch sizes",
  boundaries: [1, 5, 10, 25, 50, 100, 250, 500, 1000],
  attributes: { unit: "{row}" },
});

export const ingestDuration = Metric.timer("airfoil.connector.ingest.duration", {
  description: "Ingestor call duration in milliseconds",
  boundaries: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
  attributes: { unit: "ms" },
});

export const webhookRequests = Metric.counter("airfoil.connector.webhook.requests", {
  description: "Total webhook HTTP requests handled by connector routes",
  incremental: true,
  attributes: { unit: "{request}" },
});

export const webhookQueueDepth = Metric.gauge("airfoil.connector.webhook.queue.depth", {
  description: "Current queued webhook batches waiting for ingestion",
  attributes: { unit: "{batch}" },
});

export const syncState = Metric.gauge("airfoil.connector.sync.state", {
  description: "Connector resource sync state as a Prometheus state-set gauge",
  attributes: { unit: "1" },
});

export const lastSuccessTimestamp = Metric.gauge("airfoil.connector.last_success.timestamp", {
  description: "Unix timestamp of the last successful durable source checkpoint",
  attributes: { unit: "s" },
});

export const apiRetries = Metric.counter("airfoil.connector.api.retries", {
  description: "Total provider API retries performed by the connector",
  incremental: true,
  attributes: { unit: "{retry}" },
});

const resourceAttributes = (attrs: ResourceMetricAttrs) => ({
  [Attr.connectorName]: attrs.connector,
  [Attr.resourceName]: attrs.resource,
  [Attr.resourceSource]: attrs.source,
});

const syncAttributes = (attrs: SyncStateAttrs) => ({
  [Attr.connectorName]: attrs.connector,
  [Attr.resourceName]: attrs.resource,
});

export const recordWebhookRequest = (attrs: WebhookMetricAttrs) =>
  Metric.update(
    Metric.withAttributes(webhookRequests, {
      [Attr.connectorName]: attrs.connector,
      [Attr.webhookPath]: attrs.path,
      [Attr.webhookOutcome]: attrs.outcome,
    }),
    1,
  );

export const setWebhookQueueDepth = (connector: string, depth: number) =>
  Metric.update(
    Metric.withAttributes(webhookQueueDepth, { [Attr.connectorName]: connector }),
    depth,
  );

export const setLastSuccessTimestamp = (attrs: LastSuccessMetricAttrs, lastSuccessAt?: string) => {
  const timestamp =
    lastSuccessAt === undefined
      ? 0
      : DateTime.make(lastSuccessAt).pipe(
          Option.map((dateTime) => DateTime.toEpochMillis(dateTime) / 1000),
          Option.getOrElse(() => 0),
        );
  return Metric.update(
    Metric.withAttributes(lastSuccessTimestamp, {
      [Attr.connectorName]: attrs.connector,
      [Attr.resourceName]: attrs.resource,
      [Attr.resourceSource]: attrs.source,
    }),
    timestamp,
  );
};

export const recordApiRetry = (attrs: ApiRetryMetricAttrs) =>
  Metric.update(
    Metric.withAttributes(apiRetries, {
      [Attr.connectorName]: attrs.connector,
      [Attr.apiRetryReason]: attrs.reason,
    }),
    1,
  );

// Same statuses as `HttpClient.retryTransient`.
const transientStatuses = new Set([408, 429, 500, 502, 503, 504]);

const reasonForStatus = (status: number): ApiRetryReason =>
  status === 408 ? "timeout" : status === 429 ? "rate_limit" : "server_error";

// Effect exports the response type ID, not a guard.
const isResponse = (value: unknown): value is HttpClientResponse.HttpClientResponse =>
  Predicate.hasProperty(value, HttpClientResponse.TypeId);

/** Why `HttpClient.retryTransient` retries. Undefined for a response it keeps. */
const retryReason = (value: unknown): ApiRetryReason | undefined => {
  if (isResponse(value)) {
    return transientStatuses.has(value.status) ? reasonForStatus(value.status) : undefined;
  }
  if (HttpClientError.isHttpClientError(value) && value.reason._tag === "StatusCodeError") {
    return reasonForStatus(value.reason.response.status);
  }
  return Cause.isTimeoutError(value) ? "timeout" : "transport";
};

/**
 * A jittered exponential schedule for `HttpClient.retryTransient` that records
 * each retry with its reason.
 */
export const retrySchedule = (options: {
  readonly connector: string;
  readonly baseDelay: Duration.Input;
  readonly times: number;
}) =>
  Schedule.exponential(options.baseDelay).pipe(
    Schedule.jittered,
    Schedule.upTo({ times: options.times }),
    Schedule.tap(({ input }) => {
      const reason = retryReason(input);
      return reason === undefined
        ? Effect.void
        : recordApiRetry({ connector: options.connector, reason });
    }),
  );

const syncStates = ["pending", "backfilling", "live", "error"] as const;

export const setSyncState = (attrs: SyncStateAttrs, current: SyncState) =>
  Effect.forEach(
    syncStates,
    (state) =>
      Metric.update(
        Metric.withAttributes(syncState, {
          ...syncAttributes(attrs),
          [Attr.syncState]: state,
        }),
        state === current ? 1 : 0,
      ),
    { discard: true },
  );

/** @internal Converts the ergonomic SDK input to canonical OTel attributes. */
export const withResourceAttributes = resourceAttributes;
