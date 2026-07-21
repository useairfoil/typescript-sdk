# Airfoil TypeScript SDK

Monorepo for Airfoil TypeScript packages, CLI tools, connector authoring kits, and producer connectors.

## Packages

- `packages/connector-kit`: connector authoring/runtime primitives, manifests, hosted configuration, ingestion, publishing, durable state, status, metrics, telemetry, and webhook routing.
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

## Common Commands

Use `pnpm` from the workspace root.

```bash
pnpm run lint
pnpm run format
pnpm run build
pnpm run typecheck
pnpm run test:ci
```
