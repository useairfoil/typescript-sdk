# Airfoil TypeScript SDK

Monorepo for Airfoil TypeScript packages, CLI tools, connector authoring kits, and producer connectors.

## Packages

- `packages/connector-kit`: connector authoring/runtime primitives, manifests, pre-provision configuration checks, hosted configuration, ingestion, publishing, durable state, status, metrics, telemetry, and webhook routing.
- `packages/effect-iceberg`: Effect wrapper for the Iceberg REST Catalog client.
- `packages/effect-kubernetes`: Effect Kubernetes client and operator toolkit.
- `packages/effect-vcr`: deterministic Effect `HttpClient` record/replay helpers for API tests.
- `packages/flight`: Arrow Flight and Flight SQL client primitives.
- `packages/wings`: public Airfoil client toolkit.
- `packages/wings-testing`: Wings test helpers.
- `packages/cli`: published `airfoil` CLI.
- `packages/traceview`: trace fetch/render CLI for Axiom and Jaeger.

## Connectors

- `connectors/producer-polar`: Polar producer connector.
- `connectors/producer-shopify`: Shopify producer connector using Shopify Admin GraphQL for product backfill and Shopify webhooks for live product/cart events.

Connector packages expose their service, API client, schemas, and manifest from the package root. Use the `/manifest` subpath when only browser-safe manifest metadata is needed. Each connector also builds a separate `dist/main.js` CLI without exporting it from the library surface.

## Connector Images

Polar, Shopify, and the producer template each include a production Dockerfile. Build from the workspace through the inferred Nx target:

```bash
pnpm nx run @useairfoil/producer-polar:docker:build
pnpm nx run @useairfoil/producer-shopify:docker:build
pnpm nx run @useairfoil/producer-template:docker:build
```

The local images are tagged `airfoil/producer-<name>:local`. They run `node dist/main.js start` as the non-root `node` user and expose port `8080`. A dependency-only smoke test does not require provider credentials:

```bash
docker run --rm airfoil/producer-polar:local --help
```

Hosted connectors read user configuration from a read-only JSON file selected by `AIRFOIL_CONFIG_PATH`; matching environment values override file values. The operator separately injects platform-owned Wings, table, PostgreSQL, connector-instance, port, and telemetry settings. Never copy `.env` files or secrets into an image. Kubernetes probes use the shallow process endpoint at `GET /health`; durable progress and source errors are available at `GET /status`, and metrics at `GET /metrics`.

## Common Commands

Use `pnpm` from the workspace root.

```bash
pnpm run lint
pnpm run format
pnpm run build
pnpm run typecheck
pnpm run test:ci
pnpm beachball check
```
