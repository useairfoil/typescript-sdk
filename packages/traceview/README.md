# Traceview

This tool gets an OpenTelemetry trace from Axiom or Jaeger. It writes the trace
into one Markdown file.

## Install

```bash
pnpm add -g @useairfoil/traceview
```

## Usage

```bash
traceview <trace-id> --source axiom
traceview <trace-id> --source jaeger --out-dir ./tmp/traces
```

By default, the file is written to `traces/<trace-id>.md`.

## Configuration

| Variable            | Required  | Default                  |
| ------------------- | --------- | ------------------------ |
| `AXIOM_API_TOKEN`   | for Axiom | none                     |
| `AXIOM_DATASET`     | for Axiom | none                     |
| `AXIOM_DOMAIN`      | no        | `https://api.axiom.co`   |
| `JAEGER_BASE_URL`   | no        | `http://localhost:16686` |
| `AXIOM_START_TIME`  | no        | none                     |
| `AXIOM_END_TIME`    | no        | none                     |
| `JAEGER_START_TIME` | no        | none                     |
| `JAEGER_END_TIME`   | no        | none                     |
