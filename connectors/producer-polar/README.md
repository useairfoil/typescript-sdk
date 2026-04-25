# producer-polar

A demo connector that streams Polar data (customers, checkouts, orders, subscriptions) into Airfoil via webhooks and backfill.

---

## User guide (use the library)

This section shows how to wire the connector in your own application. The built-in sandbox is intended for internal testing only.

### Install

```bash
pnpm add @useairfoil/producer-polar
```

### Provide config via environment

The connector reads config from Effect Config. The simplest way is to provide a `ConfigProvider.fromEnv()`.

Required env vars:

```env
POLAR_ACCESS_TOKEN=polar_oat_XX
POLAR_API_BASE_URL=https://sandbox-api.polar.sh/v1/
```

Optional:

```env
POLAR_ORGANIZATION_ID=512929b6-XX
POLAR_WEBHOOK_SECRET=polar_whs_XXX
POLAR_WEBHOOK_PORT=8080
```

### Minimal wiring (Node + Fetch)

This example uses Node. Bun works too if you provide Bun's HttpServer layer.

You must provide these runtime layers:

- `PolarConnectorConfig()`
- `ConfigProvider` (usually `fromEnv`)
- `HttpServer` platform layer (Node or Bun)
- `HttpClient` layer (Fetch or VCR)
- `Publisher` and `StateStore` layers

```ts
import { FetchHttpClient } from "effect/unstable/http";
import { NodeHttpServer } from "@effect/platform-node";
import { Publisher, runConnector, StateStoreInMemory } from "@useairfoil/connector-kit";
import { ConfigProvider, Effect, Layer } from "effect";
import { createServer } from "node:http";
import { PolarConnector, PolarConnectorConfig } from "@useairfoil/producer-polar";

const ConsolePublisher = Layer.succeed(Publisher, {
  publish: () => Effect.succeed({ success: true }),
});

const program = Effect.gen(function* () {
  const { connector, routes } = yield* PolarConnector;
  const serverLayer = NodeHttpServer.layer(createServer, { port: 8080 });

  return yield* runConnector(connector, {
    initialCutoff: new Date(),
    webhook: { routes },
  }).pipe(Effect.provide(serverLayer));
}).pipe(
  Effect.provide(StateStoreInMemory),
  Effect.provide(ConsolePublisher),
  Effect.provide(FetchHttpClient.layer),
  Effect.provide(PolarConnectorConfig()),
  Effect.withConfigProvider(ConfigProvider.fromEnv()),
);

Effect.runPromise(program);
```

---

## Development (architecture and internals)

### How the connector works

```
Polar -> webhook -> /webhooks/polar -> resolveWebhookDispatch -> entity queues
                                                              |
                                                    +---------+--------+
                                                    | backfill stream   |  <- historical pages
                                                    | live stream       |  <- webhook events
                                                    +---------+--------+
                                                              |
                                                         Publisher
```

The first live webhook event for each entity sets the cutoff. Backfill then fetches historical records up to that cutoff so live and historical data do not overlap.

### Effect layers in this connector

At runtime you typically provide:

- `PolarConnectorConfig()` (builds the connector from Effect Config)
- a `ConfigProvider` (usually `ConfigProvider.fromEnv()`)
- a platform `HttpServer` layer (Node or Bun)
- an `HttpClient` layer (Fetch or VCR)
- a `Publisher` and `StateStore` layer

Minimal wiring (Node + FetchHttpClient):

```ts
import { FetchHttpClient } from "effect/unstable/http";
import { NodeHttpServer } from "@effect/platform-node";
import { Publisher, runConnector, StateStoreInMemory } from "@useairfoil/connector-kit";
import { ConfigProvider, Effect, Layer } from "effect";
import { createServer } from "node:http";
import { PolarConnector, PolarConnectorConfig } from "./src/index";

const ConsolePublisher = Layer.succeed(Publisher, {
  publish: () => Effect.succeed({ success: true }),
});

const program = Effect.gen(function* () {
  const { connector, routes } = yield* PolarConnector;
  const serverLayer = NodeHttpServer.layer(createServer, { port: 8080 });

  return yield* runConnector(connector, {
    initialCutoff: new Date(),
    webhook: { routes },
  }).pipe(Effect.provide(serverLayer));
}).pipe(
  Effect.provide(StateStoreInMemory),
  Effect.provide(ConsolePublisher),
  Effect.provide(FetchHttpClient.layer),
  Effect.provide(PolarConnectorConfig()),
  Effect.withConfigProvider(ConfigProvider.fromEnv()),
);

Effect.runPromise(program);
```

### Project structure

```
src/
├── schemas.ts    - entity schemas and webhook event union
├── api.ts        - Polar API client service (Effect HttpClient)
├── streams.ts    - stream helpers (backfill paging, live webhook stream)
├── connector.ts  - connector service (PolarConnectorConfig)
├── index.ts      - exports
└── sandbox.ts    - demo runner with console publisher
```

### Testing with VCR

The connector supports VCR-style record/replay for outgoing Polar API calls through `@useairfoil/effect-vcr` by providing the `VcrHttpClient` layer.

Minimal VCR wiring (Node test example):

```ts
import { FetchHttpClient } from "effect/unstable/http";
import { FileSystemCassetteStore, VcrHttpClient } from "@useairfoil/effect-vcr";
import { ConfigProvider, Effect, Layer } from "effect";
import { PolarConnector, PolarConnectorConfig } from "../src/index";

const vcrLayer = VcrHttpClient.layer({
  vcrName: "producer-polar",
  mode: "auto",
  matchIgnore: { requestHeaders: ["authorization"] },
  redact: { requestHeaders: ["authorization"] },
}).pipe(
  Layer.provideMerge(FileSystemCassetteStore.layer()),
  Layer.provideMerge(FetchHttpClient.layer),
);

const configProvider = ConfigProvider.fromUnknown({
  POLAR_ACCESS_TOKEN: "test",
  POLAR_API_BASE_URL: "https://sandbox-api.polar.sh/v1/",
});

const program = Effect.gen(function* () {
  const { connector } = yield* PolarConnector;
  // run connector with your publisher/state layers...
}).pipe(
  Effect.provide(PolarConnectorConfig()),
  Effect.provide(vcrLayer),
  Effect.withConfigProvider(configProvider),
);
```

Example test run from the connector directory:

```bash
POLAR_API_BASE_URL=https://sandbox-api.polar.sh/v1/ \
pnpm --filter @useairfoil/producer-polar run test
```
