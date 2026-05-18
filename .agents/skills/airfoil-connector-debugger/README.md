# airfoil-connector-debugger skill

Agent skill for diagnosing and repairing existing Airfoil producer connector
failures from traces, test failures, webhook payloads, provider docs, and
changelogs.

## What this skill does

- Starts from an observed connector failure rather than a speculative refactor.
- Uses `traceview` from `packages/traceview` as a clue to find the failing
  connector boundary.
- Requires connector-local `AGENTS.md` guidance when available, including
  provider-wide upgrade facts beyond the current connector scope.
- Compares failures with official provider docs, changelogs, cassettes, and
  webhook fixtures.
- Guides minimal connector-owned fixes for schema drift, transform bugs,
  webhook shape changes, pagination drift, auth/version issues, and SDK-mediated
  drift.
- Keeps verification deterministic through focused tests and replay artifacts.

## What this skill does not do

- It does not build new connectors. Use `airfoil-kit` for that.
- It does not treat random malformed input or invalid webhook signatures as
  provider drift.
- It does not weaken schemas without evidence.
- It does not edit VCR cassettes by hand.
- It does not add trace-specific business logic to connectors.

## Entry point

Start at [`SKILL.md`](./SKILL.md). The skill is focused on evidence-first
debugging. Each section is self-contained so you can enter from the failure
categories, traceview workflow, or connector-vs-kit decision guidance without
reading the full document first.

For trace-backed debugging, also keep the package docs open:

- `packages/traceview/README.md`
- `packages/traceview/src/cli.ts`
