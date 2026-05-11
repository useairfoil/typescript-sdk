import { Config, Duration, Effect, Layer, Option } from "effect";
import { HttpClient, HttpClientRequest } from "effect/unstable/http";

import type { FlatSpan } from "../model";
import type { TraceSourceService } from "../trace-source";

import { buildTrace, TraceSourceError } from "../model";
import { TraceSource } from "../trace-source";
import {
  asRecord,
  bigintValue,
  durationMsValue,
  keyValuesToAttributes,
  numberValue,
  stringValue,
  timestampUnixNanoValue,
} from "./utils";

const spanKindByNumber: Record<number, string> = {
  0: "unspecified",
  1: "internal",
  2: "server",
  3: "client",
  4: "producer",
  5: "consumer",
};

const statusValue = (value: unknown) => {
  const code = numberValue(value);
  if (code === 0) return "UNSET";
  if (code === 1) return "OK";
  if (code === 2) return "ERROR";
  return stringValue(value);
};

const AxiomConfig = Config.all({
  apiToken: Config.string("AXIOM_API_TOKEN"),
  dataset: Config.string("AXIOM_DATASET"),
  domain: Config.string("AXIOM_DOMAIN").pipe(Config.withDefault("https://api.axiom.co")),
  startTime: Config.option(Config.string("AXIOM_START_TIME")),
  endTime: Config.option(Config.string("AXIOM_END_TIME")),
});

type AxiomConfigShape = Config.Success<typeof AxiomConfig>;

const escapeAplString = (value: string) => value.replace(/'/g, "\\'");

/**
 * Converts the Axiom tabular response format into row objects.
 *
 * Axiom's `?format=tabular` returns columns as parallel arrays rather than an array of rows —
 * i.e. `{ fields: [{name: "trace_id"}, ...], columns: [["abc", "def"], ...] }`.
 * This pivots that structure into `[{ trace_id: "abc" }, { trace_id: "def" }, ...]`.
 */
const tabularRows = (response: unknown): ReadonlyArray<Record<string, unknown>> => {
  const tables = asRecord(response)?.tables;
  if (!Array.isArray(tables)) return [];

  return tables.flatMap((table) => {
    const record = asRecord(table);
    const fields = Array.isArray(record?.fields) ? record.fields : [];
    const columns = Array.isArray(record?.columns) ? record.columns : [];
    const names = fields
      .map((field) => stringValue(asRecord(field)?.name))
      .filter((name): name is string => !!name);
    const length = Array.isArray(columns[0]) ? columns[0].length : 0;

    return Array.from({ length }, (_, rowIndex) =>
      Object.fromEntries(
        names.map((name, fieldIndex) => [
          name,
          (columns[fieldIndex] as Array<unknown>)?.[rowIndex],
        ]),
      ),
    );
  });
};

/**
 * Merges span attributes from three possible shapes Axiom may return:
 * 1. A nested `attributes` object (when the dataset stores attrs as a JSON column).
 * 2. Flattened `attributes.*` top-level columns (when Axiom projects each attr as its own column).
 * 3. A `custom` sub-object inside either of the above (airfoil-specific user attributes).
 *
 * The merge order is nested → flattened → custom, so more-specific values win.
 */
const axiomAttributes = (row: Record<string, unknown>) => {
  const nested = asRecord(row.attributes) ?? {};
  const flattened = Object.fromEntries(
    Object.entries(row).flatMap(([key, value]) =>
      key.startsWith("attributes.") && value !== undefined && value !== null
        ? [[key.slice("attributes.".length), value]]
        : [],
    ),
  );
  const custom = asRecord(flattened.custom ?? nested.custom) ?? {};
  return { ...nested, ...flattened, ...custom };
};

export const parseAxiomTrace = (response: unknown, traceId: string): ReadonlyArray<FlatSpan> =>
  tabularRows(response).flatMap((row) => {
    const rowTraceId = stringValue(row.trace_id ?? row.traceId);
    const spanId = stringValue(row.span_id ?? row.spanId);
    const name = stringValue(row.name);
    if (rowTraceId !== traceId || !spanId || !name) return [];

    const kindValue = row.kind;
    const kindNumber = numberValue(kindValue);
    const startTimeUnixNano = timestampUnixNanoValue(
      row.startTimeUnixNano ?? row.start_time_unix_nano ?? row._time,
    );
    const durationMs = durationMsValue(row.duration_ms ?? row.durationMs ?? row.duration);
    const endTimeUnixNano =
      timestampUnixNanoValue(row.endTimeUnixNano ?? row.end_time_unix_nano) ??
      (startTimeUnixNano !== undefined && durationMs !== undefined
        ? startTimeUnixNano + BigInt(Math.trunc(durationMs * 1_000_000))
        : undefined);

    return [
      {
        traceId: rowTraceId,
        spanId,
        parentSpanId: stringValue(row.parent_span_id ?? row.parentSpanId),
        name,
        kind:
          kindNumber !== undefined
            ? spanKindByNumber[kindNumber]
            : stringValue(kindValue)?.toLowerCase(),
        status: statusValue(row["status.code"] ?? asRecord(row.status)?.code ?? row.status),
        statusMessage: stringValue(row["status.message"]),
        startTimeUnixNano,
        endTimeUnixNano,
        durationMs,
        attributes: axiomAttributes(row),
        events: Array.isArray(row.events)
          ? row.events.flatMap((event) => {
              const record = asRecord(event);
              const eventName = stringValue(record?.name);
              if (!record || !eventName) return [];
              return [
                {
                  name: eventName,
                  timeUnixNano: bigintValue(record.timeUnixNano ?? record.timestamp),
                  attributes: Array.isArray(record.attributes)
                    ? keyValuesToAttributes(record.attributes)
                    : (asRecord(record.attributes) ?? {}),
                },
              ];
            })
          : [],
      } satisfies FlatSpan,
    ];
  });

const make = Effect.fnUntraced(function* (
  config: AxiomConfigShape,
): Effect.fn.Return<TraceSourceService, TraceSourceError, HttpClient.HttpClient> {
  const baseUrl = config.domain.replace(/\/$/, "");
  const client = (yield* HttpClient.HttpClient).pipe(
    HttpClient.mapRequest(HttpClientRequest.prependUrl(baseUrl)),
    HttpClient.mapRequest(HttpClientRequest.bearerToken(config.apiToken)),
    HttpClient.mapRequest(HttpClientRequest.acceptJson),
  );

  const fetch = Effect.fnUntraced(function* (traceId: string) {
    if (!/^[0-9a-f-]+$/i.test(traceId)) {
      return yield* Effect.fail(
        new TraceSourceError({ message: `Invalid trace ID format: ${traceId}` }),
      );
    }

    // Filters to spans only (some datasets co-locate logs and spans); sort ensures
    // parent spans are returned before children, though buildTrace handles any order.
    const apl = `[${JSON.stringify(config.dataset)}] | where trace_id == '${escapeAplString(traceId)}' | where isnotempty(name) and isnotempty(span_id) | sort by _time asc`;
    const timeWindow = {
      ...(Option.isSome(config.startTime) ? { startTime: config.startTime.value } : {}),
      ...(Option.isSome(config.endTime) ? { endTime: config.endTime.value } : {}),
    };

    const request = yield* HttpClientRequest.post("/v1/datasets/_apl?format=tabular").pipe(
      HttpClientRequest.bodyJson({ apl, ...timeWindow }),
      Effect.mapError(
        (cause) => new TraceSourceError({ message: "Failed to encode Axiom query", cause }),
      ),
    );

    const { status, body } = yield* Effect.scoped(
      Effect.gen(function* () {
        const response = yield* Effect.timeoutOrElse(client.execute(request), {
          duration: Duration.seconds(30),
          orElse: () =>
            Effect.fail(new TraceSourceError({ message: "Axiom query timed out after 30s" })),
        }).pipe(
          Effect.mapError(
            (cause) => new TraceSourceError({ message: "Failed to query Axiom", cause }),
          ),
        );
        const body = yield* response.json.pipe(
          Effect.mapError(
            (cause) => new TraceSourceError({ message: "Invalid Axiom JSON response", cause }),
          ),
        );
        return { status: response.status, body };
      }),
    );

    if (status < 200 || status >= 300) {
      return yield* Effect.fail(
        new TraceSourceError({ message: `Axiom query failed with HTTP ${status}` }),
      );
    }

    const spans = parseAxiomTrace(body, traceId);
    if (spans.length === 0) {
      return yield* Effect.fail(
        new TraceSourceError({ message: `No spans found for trace ${traceId}` }),
      );
    }

    return buildTrace(traceId, "axiom", spans);
  });

  return TraceSource.of({ fetch });
});

export const layer: Layer.Layer<TraceSource, TraceSourceError, HttpClient.HttpClient> =
  Layer.effect(TraceSource)(
    Config.unwrap(AxiomConfig)
      .asEffect()
      .pipe(
        Effect.mapError(
          (cause) => new TraceSourceError({ message: "Failed to read Axiom config", cause }),
        ),
        Effect.flatMap(make),
      ),
  );
