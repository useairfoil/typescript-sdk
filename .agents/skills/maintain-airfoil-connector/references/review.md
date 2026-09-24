# Connector review

Save the review as `rfc/<provider>-connector-review.md`.

```md
# <Provider> connector review

## Current scope

What the connector supports now.

## Findings

### Confirmed issues

### Provider changes

### Missing coverage

### Reliability

### Schema changes

### Connector Kit gaps

### Docs

## Known work

Work already planned or owned somewhere else.

## Proposed work

Small groups of changes in the order we should do them.

## Later

Useful scope we are not doing now, with a short reason.

## Decisions

Anything that needs developer approval. Include a recommendation and reason.
```

Skip any findings section with nothing in it.

## Findings

For each finding, say:

- what is wrong
- what proves it
- what should change
- whether it affects existing data

Link the useful official docs. A recorded or live API response is stronger than
an example in the docs.

Do not turn a likely problem into a confirmed issue. Say what still needs a
live check.

## Resource check

Start from how the connector works today. For each resource, check what
applies:

- key and version
- every path that creates or updates rows
- pagination, cursors, cutoffs, and resume behavior
- retries, duplicates, and missed update recovery
- deletes and restores
- auth, scopes, limits, and provider versions
- schema mapping and tests against real provider responses
- the read-only config check
- compatibility with the existing Iceberg table

Compare every path that writes the same resource. They must use compatible row
shapes and the same version order.

Check what happens when a sync fails halfway and restarts.
