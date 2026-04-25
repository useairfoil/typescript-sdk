# api-mode-grpc

Implementation contract for connectors whose upstream API is gRPC.

Use this file when `api-facts.md` declares `mode: grpc`.

## Default stack

- Client transport: `nice-grpc`, `nice-grpc-common`
- Proto workflow: `@bufbuild/buf`
- Protobuf runtime default: `@bufbuild/protobuf` (repo-aligned)
- Optional compatibility/runtime tooling: `protobufjs`

## Hard rules

1. **Use buf for proto lifecycle.** Generation/lint/breaking checks are
   mandatory for gRPC connectors.
2. **Use generated service definitions with `nice-grpc`.** Avoid ad-hoc
   dynamic method wiring in connector runtime code.
3. **Wrap RPC calls in Effect.** Use `Effect.tryPromise` and map failures into
   typed `ConnectorError` (or connector-specific tagged errors mapped to it).
4. **Centralize call options.** Metadata/auth, deadline, and retry policy must
   be configured in one API-layer place, not per-call copy-paste.
5. **Pin API/proto version deterministically.** Track selected version in
   `api-facts.md`, docs, tests, and generation config.

## Directory layout

```text
connectors/producer-<name>/
  buf.yaml              # buf lint/generate config (connector root)
  src/
    proto/              # .proto source files
    api.ts              # gRPC client + Effect wrapper
    schemas.ts          # domain entity schemas
    streams.ts
    connector.ts
```

Place all `.proto` files under `src/proto/` and `buf.yaml` at the connector
package root. Generated TypeScript goes into `src/proto/gen/` (add to
`.gitignore`; regenerate via `buf generate`).

## Proto workflow

Minimum required commands for gRPC mode:

```bash
buf lint
buf breaking --against .git#branch=main
buf generate
```

If `breaking` cannot run in the local environment, document why and keep
`lint` + `generate` mandatory.

## Effect integration contract

Use a dedicated API service tag (for example `XGrpcApiClient`) built with
`Layer.effect(...)`, and structure call wrappers like this:

- convert domain request -> proto request
- invoke gRPC client method with merged `CallOptions`
- convert proto response -> domain response
- map transport/status failures to typed errors

Prefer one generic helper for repeated unary call patterns.

## Retry and timeout policy

- Set sensible default deadlines for all calls.
- Mark retryable statuses explicitly (e.g. transient unavailability).
- Do not retry non-retryable statuses (auth, permission, validation).
- Keep retry policy in API layer middleware/options, not business logic.

## Metadata/auth policy

- Inject auth metadata centrally in client construction or middleware.
- Never spread token/header construction across many call sites.
- If multiple auth modes exist, encode auth choice in config and keep one
  resolver in the API layer.

## Streaming policy

For server-streaming RPCs:

- bridge async iterator responses into connector-kit batch streams
- preserve ordering guarantees per stream
- ensure cancellation closes resources cleanly

For unary-only APIs, keep pagination/cursor continuation deterministic and
document continuation fields in `api-facts.md`.

## Protobuf runtime guidance

- **Default:** `@bufbuild/protobuf` to stay aligned with existing repo
  generation/runtime.
- **Optional:** `protobufjs` for cases requiring dynamic loading or
  compatibility with external generated assets.

If `protobufjs` is used, document exactly why and where it is required.

## Required tests

1. API integration tests covering at least one successful RPC path per shipped
   entity/event source.
2. Typed error mapping tests for at least one retryable and one
   non-retryable gRPC failure.
3. Deterministic fixture strategy for serialized payloads used in schema
   mapping tests.
4. Webhook tests where applicable (for hybrid connectors).

### VCR applicability

`vcr-workflow.md` is HTTP-client cassette guidance and does not apply directly
to binary gRPC traffic. For gRPC mode, use deterministic proto fixtures and/or
mock test servers instead of HTTP VCR cassettes.

## Anti-patterns

- Calling gRPC directly from `streams.ts`/`connector.ts` without API wrapper.
- Trying to apply HTTP VCR cassette workflow directly to gRPC binary traffic.
- Inconsistent runtime choice without documentation.
- Per-method auth/deadline logic duplicated throughout code.
- Reporting done without proto generation evidence and deterministic tests.
