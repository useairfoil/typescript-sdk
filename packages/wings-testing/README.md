# @useairfoil/wings-testing

This package provides an Effect service to test code that interacts with Wings.

You have two options:

- test against an already running instance,
- start and test against a test container.

## Usage

```ts
import { TestWings } from "@useairfoil/wings-testing";

Effect.gen(function* () {
  // Get the running instance
  const w = yield* TestWings.Instance;

  // Get `host:port` for the grpc service
  yield* w.grpcHostAndPort;

  // Get `host:port` for the http service
  yield* w.httpHostAndPort;
}).pipe(
  // Start test container
  Effect.provide(TestWings.container),
  // OR
  // Use already running instance
  Effect.provide(TestWings.external({ host: "127.0.0.1", grpcPort: 7777, httpPort: 7780 })),
);
```
