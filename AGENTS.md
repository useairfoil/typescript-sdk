# Agent Notes

## Setup

- Use `pnpm`; the repo pins `pnpm@10.33.2` in `package.json`.
- CI runs on Node 24 and installs Protoc before installing dependencies; install Protoc locally before regenerating protobuf outputs.
- Nx projects are inferred from workspace package names under `packages/*`, `connectors/*`, and `templates/*`; project names include scoped package names such as `@useairfoil/wings` and the CLI project `airfoil`.

## Commands

- Full CI-equivalent order: `pnpm run lint`, `pnpm run format`, `pnpm run build`, `pnpm run typecheck`, `pnpm run test:ci`, `pnpm beachball check`.
- Root scripts fan out through Nx: `pnpm run build`, `pnpm run typecheck`, `pnpm run test:ci`.
- Focus one package with filters, for example `pnpm --filter @useairfoil/producer-shopify run test:ci` or `pnpm --filter @useairfoil/wings run typecheck`.
- Focus one Nx target with project names, for example `pnpm nx run @useairfoil/wings:build`.
- Run a single Vitest file from a package directory or through a filter, for example `pnpm --filter @useairfoil/effect-vcr exec vitest run test/vcr-http-client.test.ts`.
- Formatting and linting use `oxfmt` and `oxlint`; fixes are `pnpm run format:fix` and `pnpm run lint:fix`.

## Package Map

- `packages/flight`: Arrow Flight/Flight SQL client primitives; protobuf sources live in `proto/` and generated TS lives in `src/proto/`.
- `packages/wings`: public Airfoil client toolkit; root export is module-first (`Cluster`, `ClusterClient`, `WingsClient`, `Arrow`, `Partition`, `Schema`, `Topic`) with several package subpath exports.
- `packages/connector-kit`: connector authoring/runtime primitives; root exports core definitions plus `Ingestion`, `Publisher`, `Streams`, `Telemetry`, and `Webhook` namespaces, `ConnectorError`, and `formatErrorForLog` for sandbox catch handlers.
- `packages/effect-vcr`: Effect `HttpClient` cassette record/replay helper used by connector API tests.
- `packages/wings-testing`: test helper that can use a running Wings instance or start one with testcontainers.
- `packages/cli`: published `airfoil` binary; `pnpm --filter airfoil run dev` runs `tsx src/index.ts`.
- `packages/traceview`: CLI + library (`@useairfoil/traceview`) that fetches a trace by ID from Axiom or Jaeger and renders it as a deterministic LLM-friendly Markdown artifact; binary is `traceview`.
- `connectors/producer-*`: private producer connectors built on `connector-kit` with API client, connector, schemas, streams, webhook route, sandbox, and VCR/webhook tests.
- `templates/producer-template`: copyable/reference producer connector; use the repo-local `airfoil-kit` skill for new producer connector work.

## Generated Code

- Do not hand-edit `packages/flight/src/proto/**` or `packages/wings/src/proto/**`; edit the matching `proto/**` files and run `pnpm --filter @useairfoil/flight run build:proto` or `pnpm --filter @useairfoil/wings run build:proto`.
- `tsdown` builds ESM only and emits declarations; `flight` and `wings` copy their `proto/` directories into `dist`.

## Tests

- Connector tests use dotenvx wrappers that ignore a missing `.env`: `pnpm --filter @useairfoil/producer-shopify run test:ci`, `pnpm --filter @useairfoil/producer-polar run test:ci`, and `pnpm --filter @useairfoil/producer-template run test:ci`.
- Connector Vitest configs disable file parallelism and set 60s test/hook timeouts; avoid re-enabling file parallelism for webhook or VCR tests.
- VCR tests default to cassette replay in CI; `ACK_DISABLE_VCR=*` forces live HTTP and should not be used for normal deterministic verification.
- `wings` tests use `packages/wings/test/setup.ts` and `testcontainers`; Docker or an equivalent testcontainer environment may be required.

## Releases

- Beachball is required for publishable package changes; CI runs `pnpm beachball check`, and `package.json` says to run `pnpm beachball change` when a change file is needed.
- Beachball disallows major change types in this repo.

## Repo-Local Agent Help

- `.agents/skills/airfoil-kit/` is the maintained playbook for implementing a new producer connector from `templates/producer-template/`.
- `.agents/skills/airfoil-connector-debugger/` is the maintained playbook for diagnosing and repairing existing producer connector failures from traces, cassettes, fixtures, provider docs, or changelogs.
- Producer and template packages can include connector-local `AGENTS.md` files. Read the nearest one before editing connector code; it contains provider-wide versioning, auth, pagination, webhook, drift-risk, and verification guidance for current and future connector work.
- For production connector failures, find the relevant trace in Axiom or Jaeger, render it with `traceview <trace-id> --source axiom` or `traceview <trace-id> --source jaeger`, then use the debugger skill and connector-local `AGENTS.md` to map the trace to a minimal fixture/VCR-backed fix.
