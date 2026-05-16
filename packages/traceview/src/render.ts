import type { Span, SpanEvent, Trace } from "./model";

import { traceDurationMs } from "./model";

const formatMs = (value: number | undefined) =>
  value === undefined ? "-" : `${value.toFixed(value < 10 ? 2 : 1)}ms`;

const renderValue = (_key: string, value: unknown) => {
  if (typeof value === "string") return value;
  return JSON.stringify(value) ?? String(value);
};

const renderAttributes = (attributes: Record<string, unknown>, indent = "") => {
  const entries = Object.entries(attributes).sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) return [`${indent}-`];
  return entries.map(([key, value]) => `${indent}${key}: ${renderValue(key, value)}`);
};

const spanTitle = (span: Span) =>
  `${span.id} ${span.name} [${span.kind ?? "-"}] [${span.status ?? "-"}] ${formatMs(span.durationMs)}`;

const renderTreeSpan = (span: Span, prefix = ""): ReadonlyArray<string> =>
  span.children.flatMap((child, index) => {
    const last = index === span.children.length - 1;
    const branch = last ? "└─ " : "├─ ";
    const nextPrefix = `${prefix}${last ? "   " : "│  "}`;
    return [`${prefix}${branch}${spanTitle(child)}`, ...renderTreeSpan(child, nextPrefix)];
  });

const renderEvents = (events: ReadonlyArray<SpanEvent>) => {
  if (events.length === 0) return ["-"];
  return events.flatMap((event) => [
    `${event.name}${event.timeUnixNano === undefined ? "" : ` @ ${event.timeUnixNano}`}:`,
    ...renderAttributes(event.attributes, "  "),
  ]);
};

const renderMetadataTable = (trace: Trace) => [
  "| Field | Value |",
  "|---|---|",
  `| Trace ID | \`${trace.traceId}\` |`,
  `| Source | ${trace.source} |`,
  `| Spans | ${trace.spans.length} |`,
  `| Root Spans | ${trace.roots.length} |`,
  `| Duration | ${formatMs(traceDurationMs(trace))} |`,
];

const renderSpanIndex = (trace: Trace) =>
  trace.spans.map(
    (span) => `- ${span.id} \`${span.name}\` [${span.kind ?? "-"}] [${span.status ?? "-"}]`,
  );

const terminalSpanIndex = (trace: Trace) =>
  trace.spans.map(
    (span) =>
      `- ${span.id} ${span.name} [${span.kind ?? "-"}] [${span.status ?? "-"}] ${formatMs(span.durationMs)}`,
  );

/**
 * Renders the trace as a Markdown document structured for LLM consumption.
 *
 * Sections (in order): metadata table → ASCII span tree → flat index → per-span details.
 * The tree gives a structural overview; the index gives stable span IDs at a glance;
 * the detail sections give full attribute and event data for each span.
 */
export const renderTraceMarkdown = (trace: Trace) =>
  [
    `# Trace \`${trace.traceId}\``,
    "",
    ...renderMetadataTable(trace),
    "",
    "## Tree",
    "",
    "```text",
    ...trace.roots.flatMap((root) => [spanTitle(root), ...renderTreeSpan(root)]),
    "```",
    "",
    "## Index",
    "",
    ...renderSpanIndex(trace),
    "",
    "## Spans",
    "",
    ...trace.spans.flatMap((span) => [
      `### ${span.id} \`${span.name}\``,
      "",
      "```text",
      `span_id: ${span.spanId}`,
      `parent_span_id: ${span.parentSpanId ?? "-"}`,
      `kind: ${span.kind ?? "-"}`,
      `status: ${span.status ?? "-"}`,
      `status_message: ${span.statusMessage ?? "-"}`,
      `duration: ${formatMs(span.durationMs)}`,
      "```",
      "",
      "#### Attributes",
      "",
      "```text",
      ...renderAttributes(span.attributes),
      "```",
      "",
      "#### Events",
      "",
      "```text",
      ...renderEvents(span.events),
      "```",
      "",
    ]),
  ].join("\n");

/**
 * Plain-text version for stdout — same structure as the Markdown render but without
 * fenced code blocks or heading markers, so it reads cleanly in a terminal.
 */
export const renderTraceTerminal = (trace: Trace) =>
  [
    `Trace ${trace.traceId}`,
    `Source: ${trace.source}`,
    `Spans: ${trace.spans.length}`,
    `Root spans: ${trace.roots.length}`,
    `Duration: ${formatMs(traceDurationMs(trace))}`,
    "",
    "Tree",
    ...trace.roots.flatMap((root) => [spanTitle(root), ...renderTreeSpan(root)]),
    "",
    "Index",
    ...terminalSpanIndex(trace),
    "",
    "Spans",
    "",
    ...trace.spans.flatMap((span) => [
      `${span.id} ${span.name}`,
      `span_id: ${span.spanId}`,
      `parent_span_id: ${span.parentSpanId ?? "-"}`,
      `kind: ${span.kind ?? "-"}`,
      `status: ${span.status ?? "-"}`,
      `status_message: ${span.statusMessage ?? "-"}`,
      `duration: ${formatMs(span.durationMs)}`,
      "",
      "Attributes",
      ...renderAttributes(span.attributes),
      "",
      "Events",
      ...renderEvents(span.events),
      "",
    ]),
  ].join("\n");
