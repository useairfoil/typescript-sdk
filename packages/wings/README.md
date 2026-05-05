# @useairfoil/wings

Effect-first TypeScript client toolkit for working with Airfoil cluster metadata,
topic schemas, and the Wings data plane.

## Modules

The package root is intentionally module-first:

```ts
import {
  Arrow,
  Cluster,
  ClusterClient,
  Partition,
  Schema,
  Topic,
  WingsClient,
  ClusterClientError,
  WingsError,
} from "@useairfoil/wings";
```

Lowercase subpath exports are also available:

```ts
import { Types, convertSchema, FieldId, TimeUnit } from "@useairfoil/wings/schema";
import * as ClusterClient from "@useairfoil/wings/cluster-client";
import * as WingsClient from "@useairfoil/wings/wings-client";
import * as Arrow from "@useairfoil/wings/arrow";
import * as Topic from "@useairfoil/wings/topic";
import * as Partition from "@useairfoil/wings/partition";
```

## Schema

Schema helpers are exposed from `@useairfoil/wings/schema`.

```ts
import {
  FieldId,
  FieldMetadata,
  SchemaMetadata,
  TimeUnit,
  Types,
  convertSchema,
} from "@useairfoil/wings/schema";

const Customer = Types.Struct({
  id: Types.String.annotate({
    [FieldId]: 1n,
    [FieldMetadata]: { pii: "true" },
  }),
  active: Types.NullOr(Types.Bool).annotate({
    [FieldId]: 2n,
  }),
  createdAt: Types.Timestamp(TimeUnit.MILLISECOND, "UTC").annotate({
    [FieldId]: 3n,
  }),
}).annotate({
  [SchemaMetadata]: { source: "example" },
});

const arrowSchema = convertSchema(Customer);
```

Available type builders: `String`, `Bool`, `Binary`, `Int8/16/32/64`, `UInt8/16/32/64`, `Float16/32/64`, `Date32/64`, `Timestamp(unit, tz?)`, `Duration(unit)`, `List(item)`, `Struct(fields)`, `NullOr(schema)`.

`TimeUnit` values: `SECOND`, `MILLISECOND`, `MICROSECOND`, `NANOSECOND`.

## Cluster Client

`ClusterClient` is the Effect service for cluster metadata operations — tenants, namespaces, topics, object stores, and data lakes.

```ts
import { Config, Effect } from "effect";
import { ClusterClient } from "@useairfoil/wings";

const clusterLayer = ClusterClient.layer({ host: "localhost:7000" });

const clusterConfigLayer = ClusterClient.layerConfig({
  host: Config.string("WINGS_CLUSTER_URL").pipe(Config.withDefault("localhost:7000")),
});
```

Example operations:

```ts
const program = Effect.gen(function* () {
  const topic = yield* ClusterClient.createTopic({
    parent: "tenants/default/namespaces/default",
    topicId: "users",
    fields: [{ name: "id", dataType: "Int32", nullable: false, id: 1n }],
    compaction: {
      freshnessSeconds: 60n,
      ttlSeconds: undefined,
      targetFileSizeBytes: 1024n * 1024n,
    },
  });

  const { topics } = yield* ClusterClient.listTopics({
    parent: "tenants/default/namespaces/default",
  });
}).pipe(Effect.provide(clusterLayer));
```

All entity types expose `create`, `get`, `list`, and `delete` operations.

## Wings Client

`WingsClient` is the Effect service for data-plane fetch and publish operations.

```ts
import { Config, Effect } from "effect";
import { WingsClient } from "@useairfoil/wings";

const wingsLayer = WingsClient.layer({
  host: "localhost:7777",
  namespace: "tenants/default/namespaces/default",
});

const wingsConfigLayer = WingsClient.layerConfig({
  host: Config.string("WINGS_URL").pipe(Config.withDefault("localhost:7777")),
  namespace: Config.string("WINGS_NAMESPACE").pipe(
    Config.withDefault("tenants/default/namespaces/default"),
  ),
});
```

### Fetch

`WingsClient.fetch` returns a stream that continuously polls a topic for new data.

```ts
import { Effect, Stream } from "effect";
import { WingsClient } from "@useairfoil/wings";

const program = Effect.gen(function* () {
  const stream = yield* WingsClient.fetch({
    topic,
    offset: 0n,
    minBatchSize: 1,
    maxBatchSize: 100,
  });

  yield* stream.pipe(Stream.take(10), Stream.runDrain);
}).pipe(Effect.provide(wingsLayer));
```

`FetchOptions`:

| Field            | Type             | Default  |
| ---------------- | ---------------- | -------- |
| `topic`          | `Topic`          | required |
| `partitionValue` | `PartitionValue` | —        |
| `offset`         | `bigint`         | `0n`     |
| `minBatchSize`   | `number`         | `1`      |
| `maxBatchSize`   | `number`         | `100`    |

### Publish

`WingsClient.publisher` creates a publisher bound to the `WingsClient` layer lifetime.

```ts
const program = Effect.gen(function* () {
  const pub = yield* WingsClient.publisher({ topic });
  const committed = yield* pub.push({ batch });
}).pipe(Effect.provide(wingsLayer));
```

Pass a `partitionValue` at publisher creation or override it per push:

```ts
const pub =
  yield *
  WingsClient.publisher({
    topic,
    partitionValue: Partition.PV.stringValue("tenant-a"),
  });

yield * pub.push({ batch, partitionValue: Partition.PV.stringValue("tenant-b") });
```

### Accessors

```ts
const clusterClient = yield * WingsClient.clusterClient;
const flightClient = yield * WingsClient.flightClient;
```

## Topic Helpers

```ts
import { Topic } from "@useairfoil/wings";

const schema = yield * Topic.topicSchema(topic); // Effect, safe
const schema = Topic.topicSchemaUnsafe(topic); // throws on invalid schema
const bytes = Topic.encodeTopicSchema(schema);
```

## Partition Helpers

```ts
import { Partition } from "@useairfoil/wings";

Partition.PV.int32(42);
Partition.PV.int64(999n);
Partition.PV.stringValue("tenant-a");
Partition.PV.bytesValue(new Uint8Array([1, 2, 3]));
Partition.PV.boolValue(true);
Partition.PV.null();
// also: int8, int16, uint8, uint16, uint32, uint64
```

## Arrow Helpers

```ts
import { Arrow } from "@useairfoil/wings";

const table = Arrow.tableFromJSON([{ id: 1, name: "Alice" }]);
const table = Arrow.recordBatchToTable(batches);
const { rows, columns } = Arrow.arrowTableToRowColumns(table);

const bytes = Arrow.serializeFieldsToSchemaBytes(fields);
const schema = Arrow.deserializeSchemaBytesToSchema(bytes);
```

## Errors

All error classes extend Effect's `Data.TaggedError` and are exported from the package root.

```ts
import {
  ClusterClientError,
  WingsError,
  WingsDecodeError,
  ConfigError,
  GrpcError,
} from "@useairfoil/wings";
```

| Class                | When thrown                      |
| -------------------- | -------------------------------- |
| `ClusterClientError` | Cluster metadata operations      |
| `WingsError`         | Data-plane fetch/publish         |
| `WingsDecodeError`   | Schema or type decoding          |
| `ConfigError`        | Invalid or missing configuration |
| `GrpcError`          | gRPC communication               |

Each error has `message`, optional `code`, and optional `cause`.
