import { Data } from "effect";

export type SpanEvent = {
  readonly name: string;
  readonly timeUnixNano?: bigint;
  readonly attributes: Record<string, unknown>;
};

export type Span = {
  readonly id: string;
  readonly traceId: string;
  readonly spanId: string;
  readonly parentSpanId?: string;
  readonly name: string;
  readonly kind?: string;
  readonly status?: string;
  readonly statusMessage?: string;
  readonly startTimeUnixNano?: bigint;
  readonly endTimeUnixNano?: bigint;
  readonly durationMs?: number;
  readonly attributes: Record<string, unknown>;
  readonly events: ReadonlyArray<SpanEvent>;
  readonly children: ReadonlyArray<Span>;
};

export type FlatSpan = Omit<Span, "id" | "children">;

export type Trace = {
  readonly traceId: string;
  readonly source: "axiom" | "jaeger";
  readonly roots: ReadonlyArray<Span>;
  readonly spans: ReadonlyArray<Span>;
};

export class TraceSourceError extends Data.TaggedError("TraceSourceError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

const compareSpanStart = (
  a: { readonly startTimeUnixNano?: bigint; readonly name: string },
  b: { readonly startTimeUnixNano?: bigint; readonly name: string },
) => {
  const aStart = a.startTimeUnixNano ?? 0n;
  const bStart = b.startTimeUnixNano ?? 0n;
  return aStart < bStart ? -1 : aStart > bStart ? 1 : a.name.localeCompare(b.name);
};

const durationMs = (start?: bigint, end?: bigint) => {
  if (start === undefined || end === undefined || end < start) return undefined;
  return Number(end - start) / 1_000_000;
};

const flattenSpans = (spans: ReadonlyArray<Span>): ReadonlyArray<Span> =>
  spans.flatMap((span) => [span, ...flattenSpans(span.children)]);

/**
 * Mutable intermediate node used while assembling the span tree.
 * Excludes `id` because IDs are assigned after the tree is fully built and sorted.
 */
type SpanNode = Omit<Span, "id" | "children"> & { readonly children: Array<SpanNode> };

/**
 * Assembles a flat span list into a tree and assigns deterministic human-readable IDs.
 *
 * IDs follow a positional path: `S1` for the first root, `S1.1` for its first child,
 * `S1.2.3` for the third child of the second child, and so on. Children are ordered
 * by `startTimeUnixNano` (then name as tiebreaker) before numbering, so the same
 * trace always produces the same IDs regardless of the order spans arrive from the source.
 *
 * Stable IDs matter because they appear in rendered artifacts that LLM agents read —
 * an agent can reference `S1.2` and that reference stays valid across re-renders.
 */
export const buildTrace = (
  traceId: string,
  source: Trace["source"],
  flatSpans: ReadonlyArray<FlatSpan>,
): Trace => {
  const nodes = new Map<string, SpanNode>();

  for (const span of flatSpans) {
    nodes.set(span.spanId, {
      ...span,
      durationMs: span.durationMs ?? durationMs(span.startTimeUnixNano, span.endTimeUnixNano),
      children: [],
    });
  }

  const roots: Array<SpanNode> = [];

  for (const span of nodes.values()) {
    const parent = span.parentSpanId ? nodes.get(span.parentSpanId) : undefined;
    if (parent) {
      parent.children.push(span);
    } else {
      roots.push(span);
    }
  }

  const assignIds = (node: SpanNode, id: string): Span => {
    const children = [...node.children]
      .sort(compareSpanStart)
      .map((child, index) => assignIds(child, `${id}.${index + 1}`));

    return { ...node, id, children };
  };

  const rootsWithIds = roots
    .sort(compareSpanStart)
    .map((span, index) => assignIds(span, `S${index + 1}`));

  return { traceId, source, roots: rootsWithIds, spans: flattenSpans(rootsWithIds) };
};

/** Wall-clock duration from the earliest span start to the latest span end. */
export const traceDurationMs = (trace: Trace) => {
  const starts = trace.spans
    .map((span) => span.startTimeUnixNano)
    .filter((value): value is bigint => value !== undefined);
  const ends = trace.spans
    .map((span) => span.endTimeUnixNano)
    .filter((value): value is bigint => value !== undefined);

  if (starts.length === 0 || ends.length === 0) return undefined;

  const minStart = starts.reduce((min, value) => (value < min ? value : min));
  const maxEnd = ends.reduce((max, value) => (value > max ? value : max));
  return durationMs(minStart, maxEnd);
};
