---
name: airfoil-connector-debugger
description: Diagnose and repair existing Airfoil producer connector failures using traces, connector-local guidance, provider docs/changelogs, fixtures, and deterministic tests. Use when a connector is failing because upstream API or webhook data changed, schemas no longer decode, transforms crash, pagination/auth/version behavior drifted, provider SDK behavior changed, or a trace needs to be mapped to a minimal connector fix.
---

# airfoil-connector-debugger

You are debugging an existing Airfoil producer connector. Work evidence-first:
start from the observed failure, render or inspect the trace when available,
identify the connector-owned boundary, compare against provider source-of-truth
docs or changelogs, reproduce deterministically, then make the smallest
connector fix that preserves useful validation.

This skill is for repairing existing connectors. For building a new connector
from scratch, use `airfoil-kit` instead.

---

## Hard rules

1. **Do not guess API shape.** Every diagnosis and fix must cite a concrete
   source: trace artifact, connector-local `AGENTS.md`, provider docs,
   changelog, recorded traffic, webhook fixture, VCR replay artifact, or exact
   code path.
2. **Read connector-local guidance first.** Before changing a connector, check
   `connectors/producer-<name>/AGENTS.md` or the matching template `AGENTS.md`.
   Treat it as provider intelligence for future upgrades, not just a summary of
   the connector's current implemented scope.
3. **Keep fixes connector-owned.** Prefer schema, transform, webhook routing,
   pagination, auth, or version fixes inside the affected connector. Do not
   change connector-kit, wings, flight, or traceview unless the failure clearly
   belongs there.
4. **Back claims with source.** If you say an API field changed, cite the
   changelog/docs URL or recorded payload. If you say the connector failed in a
   phase, cite the trace span name/attribute/error or failing test output.
5. **Do not weaken schemas blindly.** Avoid broad `Schema.Any`, catch-all enums,
   or optional fields unless provider evidence shows the data is intentionally
   open-ended or nullable.
6. **Never edit VCR cassettes by hand.** Re-record through the approved VCR flow
   or use focused fixtures for webhook/payload drift. See
   `.agents/skills/airfoil-kit/references/vcr-workflow.md` or connector test
   docs for re-record steps.
7. **Do not add trace-specific business logic.** Traces should help diagnosis;
   connector behavior should remain correct without depending on trace output.
   For example, do not gate what data is published or which code path runs on
   whether a trace is active.
8. **Separate provider drift from malformed input.** Invalid webhook signatures,
   random malformed payloads, or unauthorized requests are expected failures, not
   provider drift, unless docs or changelogs changed the contract.
9. **Make the failure reproducible before fixing when feasible.** Add or update a
   minimal test, fixture, or cassette replay that demonstrates the bug.

---

## Debugging flow

1. **Collect the symptom.** Start with the trace ID, failing test, cassette replay
   error, webhook payload, or user-provided failure text.
2. **Render the trace when available.** Use `traceview <trace-id> --source axiom`
   or `traceview <trace-id> --source jaeger`. Identify the failing span, entity,
   stream, phase, and error message. Treat the trace as a clue, not proof.
   If no trace is available, begin directly from the failing test output,
   cassette replay error, fixture, webhook payload, or user-provided failure.
3. **Read connector guidance.** Read connector-local `AGENTS.md` first. Then read
   only the files relevant to the classified failure: schema, API client,
   streams, webhook route, tests, or README as needed.
4. **Classify the failure.** Use the categories below to choose what evidence to
   gather and where to patch.
5. **Consult source of truth.** Read official provider docs, changelogs, API
   version policy, webhook docs, and recorded payloads. Prefer changelogs for
   recent shape drift.
6. **Reproduce deterministically.** Add a minimal failing fixture, webhook test,
   schema decode test, or VCR replay. Do not rely only on live behavior.
7. **Patch minimally.** Fix the narrow schema/transform/pagination/auth/webhook
   behavior that is wrong.
8. **Verify.** Run focused connector tests first, then broader checks only as
   needed for touched packages.

---

## Traceview workflow

Use `traceview` when the user gives a trace ID or when a sandbox/live run exports
traces to Axiom or Jaeger.

Location and full setup docs in this repo:

- package: `packages/traceview`
- README: `packages/traceview/README.md`
- CLI source: `packages/traceview/src/cli.ts`
- package name: `@useairfoil/traceview`
- binary: `traceview`

Local commands from the repo root:

```bash
# Build if the binary is not already available from package manager linking.
pnpm --filter @useairfoil/traceview run build

# Run the CLI through the package dev script when working from source.
pnpm --filter @useairfoil/traceview run dev -- <trace-id> --source axiom
pnpm --filter @useairfoil/traceview run dev -- <trace-id> --source jaeger
```

Installed or linked CLI usage:

```bash
traceview <trace-id> --source axiom
traceview <trace-id> --source jaeger
traceview <trace-id> --source jaeger --out-dir ./tmp/traces
```

Traceview writes a Markdown artifact to `<out-dir>/<trace-id>.md`, with `traces`
as the default output directory. Large traces may only print an artifact path;
read the Markdown file for the complete trace. Keep traceview environment setup
details in `packages/traceview/README.md`, not in this skill.

When reading a trace artifact, capture these facts before editing code:

- failing span positional ID, for example `S1.2`
- failing span name, such as `connector.api.fetch`,
  `connector.batch.process`, `connector.webhook.decode`,
  `connector.webhook.handle`, `connector.publish`, `connector.state.get`, or
  `connector.state.set`
- status and error message
- connector/entity/stream attributes when present
- error phase attributes, especially `airfoil.error.phase`
- relevant events such as `airfoil.batch.checkpoint`
- useful drift attributes when present: `airfoil.connector.name`,
  `airfoil.api.version`, `airfoil.schema.error.field`,
  `airfoil.webhook.topic`, and `airfoil.batch.entity`

Do not diagnose solely from the trace. Pair the trace evidence with at least one
source-backed contract check: connector-local `AGENTS.md`, provider docs,
provider changelog, cassette, fixture, or focused test.

---

## Failure categories

### Schema drift

Signals:

- Decode error on API response or webhook payload.
- Provider added enum value, field became nullable, numeric/string type changed,
  required field was removed upstream, timestamp/locale format changed, or nested
  object shape changed.

Evidence to collect:

- Provider changelog or versioned API docs.
- Recorded cassette response or webhook fixture showing the new value.
- Trace artifact span/error if the failure came from a trace.

Common fix:

- Update the specific schema field and add a deterministic decode test.

### Transform bug

Signals:

- Decode succeeds, but connector crashes while mapping rows or selecting cursors.
- Error phase points at transform or batch processing.

Evidence to collect:

- The decoded payload and transform assumptions.
- Existing stream cursor and primary key rules.
- Trace artifact phase/error if available.

Common fix:

- Make the transform handle documented nullability/variant shape without hiding
  invalid data.

### Webhook contract drift

Signals:

- Webhook decode fails for a provider-delivered event.
- New event type, topic, or payload variant appears.
- Webhook payload API version differs from the backfill API version.

Evidence to collect:

- Provider webhook event catalog and changelog.
- Real webhook fixture from provider dashboard or delivery log.
- Provider delivery logs showing retries, non-2xx responses, or disabled endpoint
  status.
- Trace artifact for `connector.webhook.decode` or `connector.webhook.handle`
  failures if available.

Common fix:

- Update event routing and payload schema for documented events in connector
  scope. Do not treat invalid signatures as contract drift.
- After fixing a crashing webhook handler, verify the provider endpoint is still
  active and re-enable it in the provider dashboard if retries auto-disabled it.

### Pagination or version drift

Signals:

- Backfill stops early, loops, skips records, or fails after the first page.
- Provider changed continuation headers, cursors, or API version behavior.
- Provider returns `429` after the connector accidentally sends live traffic, for
  example when VCR replay is disabled in a test run. Check replay mode before
  investigating cursor or version logic.

Evidence to collect:

- Pagination docs for the selected API version.
- At least one recorded multi-page replay when possible.
- Trace artifact for the backfill/publish/state span sequence if available.

Common fix:

- Update cursor extraction or next-page request construction, then add replay
  coverage for the page transition.

### Auth or config drift

Signals:

- Provider rejects requests after version/scope/header changes.
- Error points at API fetch/auth, not schema or transform.
- Provider requires a protected-data approval, app review, or gated scope before
  an otherwise valid token can access the entity.

Evidence to collect:

- Auth docs, required scopes, approval gates, version header/path docs, and
  connector README/env.
- Trace artifact or failing API client test showing the provider rejection.

Common fix:

- Update config docs/defaults/header construction and tests. Prefer minimum
  required scopes, and document provider approval steps when a scope is gated.

### SDK-mediated drift

Signals:

- Type errors, runtime verification failures, or behavior changes after a
  provider SDK dependency bump.
- Connector code calls a provider SDK for signing, pagination, generated clients,
  or webhook verification rather than implementing the raw HTTP contract itself.

Evidence to collect:

- `package.json` and lockfile diff for SDK version changes.
- Provider SDK changelog or release notes.
- Focused failing test showing changed SDK behavior, especially webhook signature
  verification or generated type output.

Common fix:

- Update connector usage to match the documented SDK behavior, pin or upgrade the
  SDK intentionally, and keep deterministic verification coverage for the SDK
  boundary.

### Publisher, state, or platform failure

Signals:

- Failing span is `connector.publish`, `connector.state.get`, or
  `connector.state.set`, or the trace shows Wings/client-level failure.

Evidence to collect:

- Connector-kit or Wings package tests and the exact publish/state error.
- Trace artifact identifying the failing platform span.

Common fix:

- If the failure is in provider data handling, such as schema, transform, auth, or
  version behavior, fix it in connector code.
- If the failure is in shared platform behavior, such as connector-kit, Wings, or
  flight, escalate using the decision tree below rather than masking it with
  connector workarounds.

---

## Connector vs kit decision

Before editing shared packages, decide where the failure belongs:

1. `schema`, `transform`, `api.fetch`, or `webhook.decode` phases are almost
   always connector-owned. Start in `connectors/producer-<name>/src/`.
2. `api.fetch` with provider 4xx/5xx responses points at the connector API client
   or upstream provider contract first. Check auth, scopes, approval gates,
   versioning, rate limits, and pagination before changing shared code.
3. `connector.publish`, `connector.state.get`, or `connector.state.set` may be
   connector-kit, Wings, or connector interaction. If only one connector fails,
   inspect its publish/state usage first. If multiple connectors fail the same
   way, escalate to connector-kit or Wings.
4. Effect fiber interruption, fiber death, or layer construction errors with
   stacks inside `packages/` require a shared-runtime investigation. Do not mask
   them with connector-specific logic.
5. Rule of thumb: if the minimal fix is under `connectors/producer-<name>/src/`,
   it is connector-owned. If the minimal fix is under `packages/connector-kit/`,
   `packages/wings/`, `packages/flight/`, or `packages/traceview/`, investigate
   shared package behavior explicitly and run its focused checks.

Before editing connector code, read the connector-local `AGENTS.md` for provider
auth, versioning, webhook contract, pagination, drift risks, code map, and
verification commands.

---

## Verification commands

Prefer focused checks for the touched connector:

```bash
pnpm --filter @useairfoil/producer-<name> run test:ci
pnpm --filter @useairfoil/producer-<name> run typecheck
pnpm --filter @useairfoil/producer-<name> run build
pnpm run format
pnpm run lint
```

If you changed `traceview`, also run:

```bash
pnpm --filter @useairfoil/traceview run test:ci
pnpm --filter @useairfoil/traceview run typecheck
pnpm --filter @useairfoil/traceview run build
```

For Markdown-only guidance updates, run targeted formatting checks on the edited
files.

---

## Final report expectations

Summarize:

- observed failure and failing boundary
- evidence used from trace, docs, changelog, cassette, or fixture
- minimal fix made
- deterministic reproduction added or updated
- commands run and results
- residual uncertainty, especially if live provider behavior could not be
  recorded
