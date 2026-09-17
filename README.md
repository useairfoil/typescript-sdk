# Airfoil TypeScript SDK

This repo has the TypeScript clients and connector tools for Airfoil. It also
has our producer connectors.

## Packages

- [CLI](packages/cli/README.md)
- [Connector Kit](packages/connector-kit/README.md)
- [Effect Iceberg](packages/effect-iceberg/README.md)
- [Effect Kubernetes](packages/effect-kubernetes/README.md)
- [Effect VCR](packages/effect-vcr/README.md)
- [Flight](packages/flight/README.md)
- [Traceview](packages/traceview/README.md)
- [Wings testing](packages/wings-testing/README.md)
- [Wings](packages/wings/README.md)

Connectors:

- [Polar](connectors/producer-polar/README.md)
- [Shopify](connectors/producer-shopify/README.md)
- [Producer template](templates/producer-template/README.md)

## Checks

```bash
pnpm lint
pnpm format
pnpm build
pnpm typecheck
pnpm test:ci
pnpm beachball check
```
