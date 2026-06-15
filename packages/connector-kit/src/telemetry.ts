import { Cause, Config, Effect, Layer, Option } from "effect";
import { Headers } from "effect/unstable/http";
import * as Observability from "effect/unstable/observability";

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
  connectorResourcesCount: "airfoil.connector.resources.count",
  resourceName: "airfoil.resource.name",
  resourceSource: "airfoil.resource.source",
  batchMutations: "airfoil.batch.mutations",
  webhookPath: "airfoil.webhook.path",
  publisherSuccess: "airfoil.publisher.success",
  stateKey: "airfoil.state.key",
  apiPath: "airfoil.api.path",
  errorPhase: "airfoil.error.phase",
  errorType: "airfoil.error.type",
  errorMessage: "airfoil.error.message",
  errorDetails: "airfoil.error.details",
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

const OtlpEnvConfig = Config.all({
  enabled: Config.boolean("OTEL_ENABLED").pipe(Config.withDefault(false)),
  baseUrl: Config.option(Config.string("OTEL_EXPORTER_OTLP_ENDPOINT")),
  rawHeaders: Config.option(Config.string("OTEL_EXPORTER_OTLP_HEADERS")),
});

const defaultRedactedHeaders: ReadonlyArray<string | RegExp> = [
  "authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
  /api[-_]?key/i,
  /secret/i,
  /signature/i,
  /token/i,
];

const parseOtelHeaders = (value: string): Record<string, string> =>
  Object.fromEntries(
    value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .flatMap((entry) => {
        const separator = entry.indexOf("=");
        if (separator < 1) return [];
        return [[entry.slice(0, separator).trim(), entry.slice(separator + 1).trim()]];
      }),
  );

const appendPath = (baseUrl: string, path: string) =>
  `${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;

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

const errorDetails = (error: unknown): string | undefined => {
  if (!isRecord(error) || error.cause === undefined) return undefined;
  return Cause.pretty(Cause.die(error.cause));
};

/** Annotates the active span with phase-aware error metadata before re-failing. */
export const annotateError = (phase: string, error: unknown) => {
  const details = errorDetails(error);
  return Effect.annotateCurrentSpan({
    [Attr.errorPhase]: phase,
    [Attr.errorType]: errorType(error),
    [Attr.errorMessage]: errorMessage(error),
    ...(details !== undefined ? { [Attr.errorDetails]: details } : {}),
  });
};

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

/** Transport configuration for OTLP trace export. All fields are direct values. */
export type OtlpTracingConfig = {
  readonly enabled?: boolean;
  readonly endpoint?: string;
  readonly headers?: Record<string, string>;
};

/** Runtime options — not config-wrappable since RegExp cannot live in Config. */
export type OtlpTracingOptions = {
  /** Additional connector-specific header names or regexes to redact from HTTP logs/traces. */
  readonly redactedHeaders?: ReadonlyArray<string | RegExp>;
};

const buildOtlpTracingLayer = (config: OtlpTracingConfig, options: OtlpTracingOptions) =>
  Effect.gen(function* () {
    const allRedacted = [...defaultRedactedHeaders, ...(options.redactedHeaders ?? [])];
    const RedactionLayer = Layer.succeed(Headers.CurrentRedactedNames)(allRedacted);

    if (!config.enabled) {
      return RedactionLayer;
    }

    if (!config.endpoint) {
      return yield* Effect.fail(new Error("enabled=true requires endpoint"));
    }

    yield* Effect.logInfo("telemetry enabled").pipe(
      Effect.annotateLogs({
        endpoint: config.endpoint,
        headers: config.headers ? Object.keys(config.headers) : [],
      }),
    );

    return Layer.mergeAll(
      RedactionLayer,
      Observability.OtlpTracer.layer({
        url: appendPath(config.endpoint, "/v1/traces"),
        headers: config.headers,
      }).pipe(Layer.provide(Observability.OtlpSerialization.layerJson)),
    );
  });

/**
 * Trace-only OTLP export with sensitive HTTP header redaction.
 * Takes direct config values — no `ConfigProvider` required.
 */
export const layer = (config: OtlpTracingConfig = {}, options: OtlpTracingOptions = {}) =>
  Layer.unwrap(buildOtlpTracingLayer(config, options));

/**
 * Trace-only OTLP export with sensitive HTTP header redaction.
 * Takes Effect Config-wrapped values — reads from `ConfigProvider`.
 *
 * @example
 * Telemetry.layerConfig({
 *   enabled: Config.boolean("MY_OTEL_ENABLED"),
 *   endpoint: Config.string("MY_COLLECTOR_URL"),
 * })
 */
export const layerConfig = (
  config: Config.Wrap<OtlpTracingConfig>,
  options: OtlpTracingOptions = {},
) =>
  Layer.unwrap(
    Effect.gen(function* () {
      const resolved = yield* Config.unwrap(config);
      return yield* buildOtlpTracingLayer(resolved, options);
    }),
  );

/**
 * Trace-only OTLP export with sensitive HTTP header redaction.
 * Zero-config shortcut that reads the standard `OTEL_*` env var names.
 *
 * Reads `OTEL_ENABLED`, `OTEL_EXPORTER_OTLP_ENDPOINT`, and
 * `OTEL_EXPORTER_OTLP_HEADERS`. Effect's OTLP resource handling reads
 * `OTEL_SERVICE_NAME`, `OTEL_SERVICE_VERSION`, and `OTEL_RESOURCE_ATTRIBUTES`.
 */
export const layerOtlpTracing = (options: OtlpTracingOptions = {}) =>
  Layer.unwrap(
    Effect.gen(function* () {
      const raw = yield* OtlpEnvConfig;
      return yield* buildOtlpTracingLayer(
        {
          enabled: raw.enabled,
          endpoint: Option.getOrUndefined(raw.baseUrl),
          headers: Option.isSome(raw.rawHeaders)
            ? parseOtelHeaders(raw.rawHeaders.value)
            : undefined,
        },
        options,
      );
    }),
  );
