# Producer template

Keep this as small, provider-neutral reference code. It must run without
external credentials.

Keep these patterns:

- Config lives in `src/manifest.ts`.
- Every resource has a read-only config check.
- Every resource declares required, non-null key and version fields.
- Runtime config uses Effect `Config`.
- The sandbox uses memory state and console ingestion.
- `start` uses hosted config, PostgreSQL state, and Wings ingestion.
- API tests use VCR.
- Tables with `_deleted` send `true` for deletes. If the provider can restore
  records, other rows send `false`.
- The image runs as non-root and does not copy `.env` files.

When copying the template, replace the package name, manifest, config, API
client, schemas, resources, webhook verification, and tests. Add a local
`AGENTS.md` with the provider auth, versioning, pagination, rate limits,
webhook rules, and schema risks.

The webhook verifier is a stub. A real connector must fail when the signature
or raw body is missing.
