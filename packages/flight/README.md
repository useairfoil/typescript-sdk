# Flight

This package has Effect clients for Arrow Flight and Flight SQL.

## Install

```bash
pnpm add @useairfoil/flight effect@rc
```

## Usage

```ts
import { ArrowFlightSqlClient } from "@useairfoil/flight";
import { Effect } from "effect";

const result = ArrowFlightSqlClient.executeQuery({ query: "SELECT 1" }).pipe(
  Effect.flatMap(ArrowFlightSqlClient.executeFlightInfo),
  Effect.provide(ArrowFlightSqlClient.layer({ host: "localhost:50051" })),
  Effect.scoped,
);
```
