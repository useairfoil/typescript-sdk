# anti-cheat

Pre-flight checks the agent MUST run before writing any connector code.
The purpose is to guarantee the agent demonstrates competence against the
target API rather than paraphrasing a pre-existing implementation.

## Why this matters

If a previous `producer-<target>` already exists in the repo, the agent
could trivially "build" it by copying that code. That hides whether the
skill itself actually teaches the agent to design connectors. Worse, it
lets stale implementations slip into new work unnoticed.

## Pre-flight checks (run in order)

Run all of these from the repo root. If **any** surfaces the target
service, STOP and surface to the user.

### 1. Direct name match in source

```bash
rg -n "<target>" connectors packages --glob '!**/node_modules' --glob '!**/dist' -i
```

Matches service name in source files. A hit means someone has already
referenced this service.

### 2. Connector directory exists

```bash
ls connectors/ | rg -i "<target>"
```

Hit => a full connector already exists; stop.

### 3. Build outputs leak implementation

```bash
ls packages/*/dist 2>/dev/null | rg -i "<target>" || true
ls connectors/*/dist 2>/dev/null | rg -i "<target>" || true
```

Hit => stale build output likely from an earlier implementation.

### 4. Node modules leak implementation

```bash
ls node_modules 2>/dev/null | rg -i "producer-<target>" || true
ls node_modules/@useairfoil 2>/dev/null | rg -i "<target>" || true
```

Hit => a published package exists; do not install or inspect it.

### 5. Git history mentions the target

```bash
git log --oneline --all 2>/dev/null | rg -i "<target>" | head -n 20
```

Hits are informational. If they describe a prior attempt, ask the user
whether that attempt should be resumed/rebased or whether this is a
clean rebuild.

## What "STOP" means

STOP means:

1. Do not read the pre-existing files.
2. Do not `cat`, `Read`, or `Grep` inside the matched paths.
3. Surface the finding to the user with:
   - Exact paths that matched.
   - A short summary ("prior `connectors/producer-<target>/` present").
   - A decision prompt: "Should I delete and rebuild from scratch, or
     continue the existing work (which bypasses this skill)?"

The user decides. Do not assume.

## External anti-cheat rule

Do not inspect external repositories, gists, or branches that already
implement `producer-<target>` for the same service just to copy schemas,
endpoints, or dispatch logic. The goal is to derive implementation details
from official docs plus recorded traffic, not from prior connector code.

## Safe to read

These are fine to read regardless of matches:

- `packages/connector-kit/src/**` (the framework itself).
- `packages/effect-vcr/src/**`.
- `templates/producer-template/**` (this skill's starting point).
- `connectors/producer-polar/**` (the kitchen-sink reference).
- This `.agents/` directory.

These are the "allowed references" and form the only body of prior
connector code you should study.

## False-positive handling

If the matches are obviously unrelated (e.g., searching for "github" hits
`.github/workflows/build.yaml`), note the finding and continue. Use your
judgment — the intent is to block cribbing, not to block mentions.

Rule of thumb: if the match is **your target's source code or schemas**,
STOP. If the match is **ambient tooling with the same word**, continue
but note it.

## Example

```
$ rg -n "stripe" connectors packages --glob '!**/node_modules' -i
(no output)
$ ls connectors/ | rg -i "stripe"
(no output)
$ ls packages/*/dist 2>/dev/null | rg -i "stripe" || true
(no output)
$ ls node_modules 2>/dev/null | rg -i "producer-stripe" || true
(no output)
$ git log --oneline --all | rg -i "stripe" | head -n 20
(no output)

Anti-cheat clear. Proceeding with producer-stripe.
```

## Documenting the outcome

Log the result in your scratch notes or in the PR description:

> Anti-cheat pre-flight: clean. No prior `producer-stripe` artifacts in
> `connectors/`, `packages/*/dist`, `node_modules`, or git history.

This is a cheap trust signal for reviewers.
