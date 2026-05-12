import { Effect } from "effect";

/** Canonical span names emitted by connector-kit runtime instrumentation. */
export const SpanName = {
  batchProcess: "connector.batch.process",
  webhookDecode: "connector.webhook.decode",
  webhookHandle: "connector.webhook.handle",
  publish: "connector.publish",
  stateSet: "connector.state.set",
  apiFetch: "connector.api.fetch",
} as const;

/** Canonical span attribute names. Keep these stable for collector queries. */
export const Attr = {
  connectorName: "airfoil.connector.name",
  connectorEntitiesCount: "airfoil.connector.entities.count",
  connectorEventsCount: "airfoil.connector.events.count",
  streamName: "airfoil.stream.name",
  streamSource: "airfoil.stream.source",
  batchRows: "airfoil.batch.rows",
  webhookPath: "airfoil.webhook.path",
  publisherSuccess: "airfoil.publisher.success",
  stateKey: "airfoil.state.key",
  apiPath: "airfoil.api.path",
  errorPhase: "airfoil.error.phase",
  errorType: "airfoil.error.type",
  errorMessage: "airfoil.error.message",
} as const;

/** Span event names for high-cardinality reproduction details. */
export const EventName = {
  batchCheckpoint: "airfoil.batch.checkpoint",
} as const;

/** Event-only attributes. These are intentionally not span attributes. */
export const EventAttr = {
  batchCursor: "airfoil.batch.cursor",
} as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const maxErrorMessageLength = 500;

/**
 * Best-effort stable error classifier for span metadata.
 *
 * Effect/Data tagged errors expose `_tag`; that is the most useful value for
 * connector bugs (`ConnectorError`, `InvalidWebhookPayloadError`, etc.). For
 * non-tagged errors we fall back to the JS `Error.name`, then constructor name,
 * then the primitive type.
 */
const errorType = (error: unknown) => {
  if (isRecord(error) && typeof error._tag === "string") {
    return String(error._tag);
  }
  if (error instanceof Error) {
    return error.name;
  }
  if (isRecord(error) && typeof error.constructor?.name === "string") {
    return error.constructor.name;
  }
  return typeof error;
};

/**
 * Human-readable error summary for span metadata.
 *
 * Tagged errors in this package carry a `message` field, so this preserves the
 * important diagnostic text. Unknown object failures are intentionally reduced
 * to their type; full structured error payloads belong in logs, not span attrs.
 */
const errorMessage = (error: unknown) => {
  const message = (() => {
    if (isRecord(error) && typeof error.message === "string") {
      return error.message;
    }
    if (typeof error === "string") {
      return error;
    }
    return errorType(error);
  })();

  if (message.length > maxErrorMessageLength) {
    return `${message.slice(0, maxErrorMessageLength)}...`;
  }

  return message;
};

/** Annotates the active span with phase-aware error metadata before re-failing. */
export const annotateError = (phase: string, error: unknown) =>
  Effect.annotateCurrentSpan({
    [Attr.errorPhase]: phase,
    [Attr.errorType]: errorType(error),
    [Attr.errorMessage]: errorMessage(error),
  });

/** Adds an event to the active span, or no-ops when no span is active. */
export const addCurrentSpanEvent = (name: string, attributes?: Record<string, unknown>) =>
  Effect.currentSpan.pipe(
    Effect.flatMap((span) =>
      Effect.clockWith((clock) =>
        Effect.sync(() => span.event(name, clock.currentTimeNanosUnsafe(), attributes)),
      ),
    ),
    Effect.ignore,
  );
