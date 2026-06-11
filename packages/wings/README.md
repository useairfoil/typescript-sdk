# @useairfoil/wings

Effect-first TypeScript client toolkit for working with Airfoil cluster metadata,
table schemas, and the Wings data plane.

## Modules

The package root is intentionally module-first:

```ts
import {
  Arrow,
  Cluster,
  ClusterClient,
  PartitionValue,
  Schema,
  TableUtils,
  WingsClient,
  ClusterClientError,
  WingsError,
} from "@useairfoil/wings";
```

Lowercase subpath exports are also available:

```ts
import { Types, convertSchema, FieldId, TimeUnit } from "@useairfoil/wings/schema";
import * as ClusterClient from "@useairfoil/wings/cluster-client";
import * as WingsClient from "@useairfoil/wings/data-plane";
import * as Arrow from "@useairfoil/wings/arrow";
import * as TableUtils from "@useairfoil/wings/utils/table-utils";
import * as PartitionValue from "@useairfoil/wings/utils/partition-value";
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

`ClusterClient` is the Effect service for cluster metadata operations: namespaces and tables. Namespace resources include embedded object store and lake configuration.

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
  const namespace = yield* ClusterClient.createNamespace({
    namespaceId: "default",
    objectStore: {
      objectStoreConfig: {
        _tag: "s3Compatible",
        s3Compatible: {
          bucketName: "default-bucket",
          endpoint: "http://localhost:8333",
          region: "us-east-1",
          accessKeyId: "wingsdevaccesskey",
          secretAccessKey: "wingsdevsecretkey",
          allowHttp: true,
        },
      },
    },
    lake: { lakeConfig: { _tag: "parquet", parquet: {} } },
  });

  const table = yield* ClusterClient.createTable({
    parent: namespace.name,
    tableId: "users",
    fields: [{ name: "id", dataType: "Int32", nullable: false, id: 1n }],
    keyFieldId: 1n,
    versionFieldId: 1n,
    targetFreshnessSeconds: 60n,
  });

  const { tables } = yield* ClusterClient.listTables({
    parent: namespace.name,
  });
}).pipe(Effect.provide(clusterLayer));
```

Namespace and table resources expose `create`, `get`, `list`, and `delete` operations. Namespaces also expose `updateNamespace`.

## Wings Client

`WingsClient` is the Effect service for data-plane fetch and publish operations.

```ts
import { Config, Effect } from "effect";
import { WingsClient } from "@useairfoil/wings";

const wingsLayer = WingsClient.layer({
  host: "localhost:7777",
  namespace: "namespaces/default",
});

const wingsConfigLayer = WingsClient.layerConfig({
  host: Config.string("WINGS_URL").pipe(Config.withDefault("localhost:7777")),
  namespace: Config.string("WINGS_NAMESPACE").pipe(Config.withDefault("namespaces/default")),
});
```

### Fetch

`WingsClient.fetch` returns a stream that continuously polls a table for new data.

```ts
import { Effect, Stream } from "effect";
import { WingsClient } from "@useairfoil/wings";

const program = Effect.gen(function* () {
  const stream = yield* WingsClient.fetch({
    table,
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
| `table`          | `Table`          | required |
| `partitionValue` | `PartitionValue` | —        |
| `offset`         | `bigint`         | `0n`     |
| `minBatchSize`   | `number`         | `1`      |
| `maxBatchSize`   | `number`         | `100`    |

### Publish

`WingsClient.publisher` creates a publisher bound to the `WingsClient` layer lifetime.

```ts
const program = Effect.gen(function* () {
  const pub = yield* WingsClient.publisher({ table });
  const committed = yield* pub.push({ batch });
}).pipe(Effect.provide(wingsLayer));
```

Pass a `partitionValue` at publisher creation or override it per push:

```ts
const pub =
  yield *
  WingsClient.publisher({
    table,
    partitionValue: PartitionValue.stringValue("tenant-a"),
  });

yield * pub.push({ batch, partitionValue: PartitionValue.stringValue("tenant-b") });
```

### Accessors

```ts
const clusterClient = yield * WingsClient.clusterClient;
const flightClient = yield * WingsClient.flightClient;
```

## Table Helpers

```ts
import { TableUtils } from "@useairfoil/wings";

const schema = yield * TableUtils.tableSchema(table); // Effect, safe
const schema = TableUtils.tableSchemaUnsafe(table); // throws on invalid schema
const bytes = TableUtils.encodeTableSchema(schema);
```

## Partition Helpers

```ts
import { PartitionValue } from "@useairfoil/wings";

PartitionValue.int32(42);
PartitionValue.int64(999n);
PartitionValue.stringValue("tenant-a");
PartitionValue.bytesValue(new Uint8Array([1, 2, 3]));
PartitionValue.boolValue(true);
PartitionValue.null();
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
