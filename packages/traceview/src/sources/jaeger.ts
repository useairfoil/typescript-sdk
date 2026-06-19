import { Config, Duration, Effect, Layer, Option } from "effect";
import { HttpClient, HttpClientRequest } from "effect/unstable/http";

import type { FlatSpan } from "../model";
import type { TraceSourceService } from "../trace-source";

import { buildTrace, TraceSourceError } from "../model";
import { TraceSource } from "../trace-source";
import {
  asRecord,
  bigintValue,
  keyValuesToAttributes,
  numberValue,
  otelEvents,
  stringValue,
} from "./utils";

const spanKindByNumber: Record<number, string> = {
  0: "unspecified",
  1: "internal",
  2: "server",
  3: "client",
  4: "producer",
  5: "consumer",
};

const spanStatusByNumber: Record<number, string> = {
  0: "UNSET",
  1: "OK",
  2: "ERROR",
};

const JaegerConfig = Config.all({
  baseUrl: Config.string("JAEGER_BASE_URL").pipe(Config.withDefault("http://localhost:16686")),
  startTime: Config.option(Config.string("JAEGER_START_TIME")),
  endTime: Config.option(Config.string("JAEGER_END_TIME")),
});

type JaegerConfigShape = Config.Success<typeof JaegerConfig>;

const normalizeOtlpKind = (kind: unknown) => {
  const numeric = numberValue(kind);
  if (numeric !== undefined) return spanKindByNumber[numeric] ?? String(numeric);

  const value = stringValue(kind)?.toLowerCase();
  return value?.startsWith("span_kind_") ? value.slice("span_kind_".length) : value;
};

const normalizeOtlpStatus = (status: unknown) => {
  const rawCode = asRecord(status)?.code ?? status;
  const numeric = numberValue(rawCode);
  if (numeric !== undefined) return spanStatusByNumber[numeric] ?? String(numeric);

  const code = stringValue(rawCode)?.toUpperCase();
  return code?.startsWith("STATUS_CODE_") ? code.slice("STATUS_CODE_".length) : code;
};

export const parseJaegerTrace = (response: unknown, traceId: string): ReadonlyArray<FlatSpan> => {
  const result = asRecord(response)?.result ?? response;
  const resourceSpans = asRecord(result)?.resource_spans ?? asRecord(result)?.resourceSpans;
  if (!Array.isArray(resourceSpans)) return [];

  return resourceSpans.flatMap((resourceSpan) => {
    const resource = asRecord(resourceSpan)?.resource;
    const resourceAttributes = keyValuesToAttributes(asRecord(resource)?.attributes);
    const scopeSpans = asRecord(resourceSpan)?.scope_spans ?? asRecord(resourceSpan)?.scopeSpans;
    if (!Array.isArray(scopeSpans)) return [];

    return scopeSpans.flatMap((scopeSpan) => {
      const spans = asRecord(scopeSpan)?.spans;
      if (!Array.isArray(spans)) return [];

      return spans.flatMap((span) => {
        const record = asRecord(span);
        const spanId = stringValue(record?.span_id ?? record?.spanId);
        const name = stringValue(record?.name);
        if (!record || !spanId || !name) return [];

        return [
          {
            traceId,
            spanId,
            parentSpanId: stringValue(record.parent_span_id ?? record.parentSpanId),
            name,
            kind: normalizeOtlpKind(record.kind),
            status: normalizeOtlpStatus(record.status),
            statusMessage: stringValue(asRecord(record.status)?.message),
            startTimeUnixNano: bigintValue(record.start_time_unix_nano ?? record.startTimeUnixNano),
            endTimeUnixNano: bigintValue(record.end_time_unix_nano ?? record.endTimeUnixNano),
            attributes: {
              ...resourceAttributes,
              ...keyValuesToAttributes(record.attributes),
            },
            events: otelEvents(record.events),
          } satisfies FlatSpan,
        ];
      });
    });
  });
};

const traceUrl = (
  baseUrl: string,
  traceId: string,
  options: { readonly startTime: Option.Option<string>; readonly endTime: Option.Option<string> },
) => {
  const url = new URL(`${baseUrl}/api/v3/traces/${traceId}`);
  if (Option.isSome(options.startTime)) url.searchParams.set("start_time", options.startTime.value);
  if (Option.isSome(options.endTime)) url.searchParams.set("end_time", options.endTime.value);
  url.searchParams.set("raw_traces", "true");
  return url.toString();
};

const make = Effect.fnUntraced(function* (
  config: JaegerConfigShape,
): Effect.fn.Return<TraceSourceService, TraceSourceError, HttpClient.HttpClient> {
  const baseUrl = config.baseUrl.replace(/\/$/, "");
  const client = yield* HttpClient.HttpClient;

  const fetch = Effect.fnUntraced(function* (traceId: string) {
    const url = traceUrl(baseUrl, traceId, {
      startTime: config.startTime,
      endTime: config.endTime,
    });

    const { status, body } = yield* Effect.scoped(
      Effect.gen(function* () {
        const response = yield* Effect.timeoutOrElse(client.execute(HttpClientRequest.get(url)), {
          duration: Duration.seconds(30),
          orElse: () =>
            Effect.fail(new TraceSourceError({ message: "Jaeger query timed out after 30s" })),
        }).pipe(
          Effect.mapError(
            (cause) => new TraceSourceError({ message: "Failed to query Jaeger", cause }),
          ),
        );
        const body = yield* response.json.pipe(
          Effect.mapError(
            (cause) => new TraceSourceError({ message: "Invalid Jaeger JSON response", cause }),
          ),
        );
        return { status: response.status, body };
      }),
    );

    if (status < 200 || status >= 300) {
      return yield* Effect.fail(
        new TraceSourceError({ message: `Jaeger query failed with HTTP ${status}` }),
      );
    }

    const spans = parseJaegerTrace(body, traceId);
    if (spans.length === 0) {
      return yield* Effect.fail(
        new TraceSourceError({ message: `No spans found for trace ${traceId}` }),
      );
    }

    return buildTrace(traceId, "jaeger", spans);
  });

  return TraceSource.of({ fetch });
});

export const layer: Layer.Layer<TraceSource, TraceSourceError, HttpClient.HttpClient> =
  Layer.effect(TraceSource)(
    Config.unwrap(JaegerConfig).pipe(
      Effect.mapError(
        (cause) => new TraceSourceError({ message: "Failed to read Jaeger config", cause }),
      ),
      Effect.flatMap(make),
    ),
  );
