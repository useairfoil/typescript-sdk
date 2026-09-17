# Wings testing

Use this package when a test needs Wings.

## Install

```bash
pnpm add -D @useairfoil/wings-testing effect@rc
```

## Usage

```ts
import { TestWings } from "@useairfoil/wings-testing";
import { Effect } from "effect";

const uri = TestWings.Instance.use((wings) => wings.uri).pipe(
  Effect.provide(TestWings.container),
  Effect.scoped,
);
```
