# @useairfoil/traceview

Fetch an OpenTelemetry trace from Axiom or Jaeger and render it into a single, deterministic Markdown file — structured for human reading and LLM agent consumption.

## Install

```bash
npm install -g @useairfoil/traceview
# or
pnpm add -g @useairfoil/traceview
```

## Quick start

```bash
traceview <trace-id> --source axiom
```

The rendered Markdown is written to `./traces/<trace-id>.md`. If the render is small enough, traceview also prints a plain-text terminal preview; large traces only print a warning and the artifact path.

---

## CLI

```bash
traceview <trace-id> --source <axiom|jaeger> [--out-dir <dir>]
```

| Flag        | Default  | Description                                |
| ----------- | -------- | ------------------------------------------ |
| `--source`  | required | `axiom` or `jaeger`                        |
| `--out-dir` | `traces` | Directory where `<trace-id>.md` is written |

### Examples

```bash
# Fetch from Axiom and write to ./traces/
traceview abc123 --source axiom

# Fetch from Jaeger, write to a custom directory
traceview abc123 --source jaeger --out-dir ./tmp/traces
```

---

## Sources

### Axiom

Set these environment variables before running:

```env
AXIOM_API_TOKEN=<your-query-token>
AXIOM_DATASET=your-dataset-name
AXIOM_DOMAIN=https://api.axiom.co     # optional — this is the default
```

Optionally narrow the query to a time window (ISO 8601):

```env
AXIOM_START_TIME=2026-05-09T00:00:00Z
AXIOM_END_TIME=2026-05-10T00:00:00Z
```

Without a time window, Axiom searches the full dataset history. Specifying a window speeds up the query significantly for large datasets. Axiom span timing is read from normal OTel timestamp fields or from `_time` plus `duration`.

### Jaeger

```env
JAEGER_BASE_URL=http://localhost:16686  # optional — this is the default
```

Optionally narrow the query to a time window:

```env
JAEGER_START_TIME=2026-05-09T00:00:00Z
JAEGER_END_TIME=2026-05-10T00:00:00Z
```

Traceview reads Jaeger v3 trace responses from `/api/v3/traces/:id` and normalizes standard OTel span kind and status values for display.

---

## Output

The Markdown artifact has four sections:

**Metadata table** — trace ID, source, span count, total duration.

**Tree** — ASCII span tree showing parent-child relationships and timing at a glance.

```text
S1 connector.batch.process [internal] [OK] 843.0ms
├─ S1.1 connector.publish [producer] [OK] 12.3ms
└─ S1.2 connector.state.set [internal] [OK] 0.8ms
```

**Index** — flat list of all spans with their IDs.

**Spans** — full detail for each span: span ID, kind, status, duration, attributes, and events.

For terminal output, traceview renders the same information in plain text without Markdown headings, tables, or code fences.

### Span IDs

Spans are assigned positional IDs (`S1`, `S1.1`, `S1.2.3`) based on their position in the tree, sorted by start time. The same trace always produces the same IDs regardless of the order spans are returned by the backend — so an LLM agent can reference `S1.2` across multiple renders.

### Sensitive value redaction

Attribute values are automatically redacted if their key matches any of: `authorization`, `cookie`, `set-cookie`, `token`, `secret`, `password`, `signature`, `api-key`, `apikey`, `x-api-key`. Redaction applies recursively to nested objects and arrays.
