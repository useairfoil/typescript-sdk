# airfoil-kit skill

Agent skill that walks an AI coding assistant through implementing a new
Airfoil producer connector end-to-end.

For diagnosing or repairing an existing connector from traces, provider drift,
schema failures, webhook payloads, or cassette replay errors, use the
`airfoil-connector-debugger` skill instead.

## What this skill does

- Confirms no existing implementation is being copied.
- Copies `templates/producer-template/` into `connectors/producer-<name>/`.
- Adds a connector-local `AGENTS.md` with provider-wide facts and future upgrade
  guidance for debugging agents.
- Helps you research the target API and derive schemas from provider docs plus recorded traffic.
- Wires current Effect v4 `Config`, API client layers, `Resource.entity(...)`,
  `Fetch.page(...)`, `Webhook.route(...)`, and connector layers.
- Guides deterministic replay testing (VCR for REST/GraphQL, fixtures/mocks for gRPC).
- Enforces a Definition of Done before declaring the task complete.

Primary intent: enforce a docs-first, evidence-based process that adapts to
any target platform without hardcoding provider-specific assumptions.

## Entry point

Start at [`SKILL.md`](./SKILL.md). It contains the hard rules and a pointer
index; load the `references/<topic>.md` files on demand as you progress.

Canonical process docs:

- `SKILL.md`
- `references/playbook.md`
- `references/api-research.md`
- `references/definition-of-done.md`

Example-oriented docs are optional aids, not normative contracts.

## Public package surfaces you should know

Current root surfaces used most often by connector work:

- `@useairfoil/connector-kit`
  - core exports flattened at root
  - `Ingestion`
  - `Publisher`
  - `Telemetry`
  - `Webhook`
  - flat root errors
- `@useairfoil/effect-vcr`
  - `CassetteStore`
  - `FileSystemCassetteStore`
  - `VcrHttpClient`
  - flat root VCR types
  - focused subpath exports for cassette store, file-system cassette store,
    types, and VCR HTTP client
- `@useairfoil/wings`
  - `Cluster`
  - `ClusterClient`
  - `WingsClient`
  - `Arrow`
  - `Partition`
  - `Schema`
  - `Table`
  - flat root errors
- `@useairfoil/flight`
  - `ArrowFlightClient`
  - `ArrowFlightSqlClient`
  - `FlightClientError`
  - root encoder/proto exports and typed client options

When writing examples or guidance, prefer the actual current package surface
over historical helper names or internal file-level imports.

## Files

```
SKILL.md                               # orchestrator
references/
├── playbook.md                        # numbered end-to-end flow
├── template-walkthrough.md            # file-by-file tour of producer-template
├── connector-archetypes.md            # generic capability classification framework
├── api-mode-graphql.md                # GraphQL implementation contract
├── api-mode-grpc.md                   # gRPC implementation contract
├── connector-kit-api.md               # exhaustive @useairfoil/connector-kit docs
├── effect-vcr-api.md                  # current @useairfoil/effect-vcr docs and wiring
├── effect-v4-essentials.md            # Effect v4 idioms relevant to connectors
├── patterns.md                        # shared naming, layer, cursor, cutoff, and stream patterns
├── webhooks.md                        # Webhook.Route + signature verification
├── vcr-workflow.md                    # deterministic VCR workflow + redaction
├── api-research.md                    # how to learn a real API's shape
├── anti-cheat.md                      # pre-flight checks
├── test-data.md                       # sandbox creds, seeding, coverage
├── definition-of-done.md              # gates before marking complete
├── example-producer-polar.md          # REST/multi-entity connector walkthrough
├── example-pagination.md              # optional pagination pattern catalog
├── example-auth.md                    # optional auth implementation patterns
└── example-webhook-verification.md    # optional verification examples
assets/
└── rename-checklist.md                # exact find/replace list after cp -R
```
