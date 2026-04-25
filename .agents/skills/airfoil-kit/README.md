# airfoil-kit skill

Agent skill that walks an AI coding assistant through implementing a new
Airfoil producer connector end-to-end.

## What this skill does

- Confirms no existing implementation is being copied.
- Copies `templates/producer-template/` into `connectors/producer-<name>/`.
- Helps you research the target API and derive schemas from recorded traffic.
- Wires Effect v4 `Config`, API clients, `WebhookRoute`, and streams.
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
├── effect-vcr-api.md                  # exhaustive @useairfoil/effect-vcr docs
├── effect-v4-essentials.md            # Effect v4 idioms relevant to connectors
├── patterns.md                        # shared patterns (cursor, cutoff, streams)
├── webhooks.md                        # WebhookRoute + signature verification
├── vcr-workflow.md                    # record/replay + ACK_DISABLE_VCR
├── api-research.md                    # how to learn a real API's shape
├── anti-cheat.md                      # pre-flight checks
├── test-data.md                       # sandbox creds, seeding, coverage
├── definition-of-done.md              # gates before marking complete
├── example-producer-polar.md          # kitchen-sink reference walkthrough
├── example-pagination.md              # optional pagination pattern catalog
├── example-auth.md                    # optional auth implementation patterns
└── example-webhook-verification.md    # optional verification examples
assets/
└── rename-checklist.md                # exact find/replace list after cp -R
```
