# Airfoil TypeScript SDK

Keep changes small and leave unrelated work alone.

## Git

This repo uses GitButler on `gitbutler/workspace`. Use `but` for branches,
commits, history, merges, and pushes. Run `but` with escalated permissions
because it writes to the GitButler database under `.git`. Do not run
`but setup`.

Do not change Git state unless the user asks.

## Generated code

Do not edit `packages/flight/src/proto/**`. Change the protobuf source under
`packages/flight/proto/**`, then run:

```bash
pnpm --filter @useairfoil/flight build:proto
```

## Connectors

Keep provider code inside its connector. Shared runtime code belongs in
Connector Kit.

- Put user config in `src/manifest.ts`.
- Use Effect `Config`, not `process.env`.
- Hosted runs use `RuntimeConfig.layerHosted()`, PostgreSQL state, and
  `Ingestor.layerWingsConfig(...)`.
- Memory state is only for the sandbox and tests.
- Every resource needs a read-only config check.
- Verify signed webhooks against the raw body.
- Record API tests with VCR. Do not edit cassettes by hand.
- `ACK_DISABLE_VCR=*` makes live requests. Do not use it for normal tests.
- Never log or commit secrets.

## Releases

Published package changes need a Beachball change file. Major changes are not
allowed.
