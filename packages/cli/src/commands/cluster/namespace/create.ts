import * as p from "@clack/prompts";
import { ClusterClient } from "@useairfoil/wings";
import { printTable } from "console-table-printer";
import { Effect } from "effect";
import { Command, Flag } from "effect/unstable/cli";

import { makeClusterClientLayer } from "../../../utils/client";
import { hostOption, portOption } from "../../../utils/options";

const parentOption = Flag.string("parent").pipe(
  Flag.withDescription("Parent tenant in format: tenants/{tenant} (e.g., 'tenants/default')"),
);

const namespaceIdOption = Flag.string("namespace-id").pipe(
  Flag.withDescription("Unique identifier for the namespace (e.g., 'production')"),
);

const flushSizeBytesOption = Flag.integer("flush-size-bytes").pipe(
  Flag.withDescription("Size at which the current segment is flushed to object storage"),
  Flag.withDefault(0),
);

const flushIntervalMillisOption = Flag.integer("flush-interval-millis").pipe(
  Flag.withDescription("Maximum interval at which the current segment is flushed (milliseconds)"),
  Flag.withDefault(0),
);

const objectStoreOption = Flag.string("object-store").pipe(
  Flag.withDescription(
    "Object store used by this namespace (format: tenants/{tenant}/object-stores/{object-store})",
  ),
);

const dataLakeOption = Flag.string("data-lake").pipe(
  Flag.withDescription(
    "Data lake used by this namespace (format: tenants/{tenant}/data-lakes/{data-lake})",
  ),
);

export const createNamespaceCommand = Command.make(
  "create-namespace",
  {
    parent: parentOption,
    namespaceId: namespaceIdOption,
    flushSizeBytes: flushSizeBytesOption,
    flushIntervalMillis: flushIntervalMillisOption,
    objectStore: objectStoreOption,
    dataLake: dataLakeOption,
    host: hostOption,
    port: portOption,
  },
  ({ parent, namespaceId, flushSizeBytes, flushIntervalMillis, objectStore, dataLake }) =>
    Effect.gen(function* () {
      p.intro("📁 Create Namespace");

      const s = p.spinner();
      s.start("Creating namespace...");

      const namespace = yield* ClusterClient.createNamespace({
        parent,
        namespaceId,
        flushSizeBytes: BigInt(flushSizeBytes),
        flushIntervalMillis: BigInt(flushIntervalMillis),
        objectStore,
        dataLake,
      }).pipe(Effect.tapError(() => Effect.sync(() => s.stop("Failed to create namespace"))));

      s.stop("Namespace created successfully");

      yield* Effect.sync(() => {
        printTable([
          {
            name: namespace.name,
            flush_size_bytes: namespace.flushSizeBytes.toString(),
            flush_interval_millis: namespace.flushIntervalMillis.toString(),
            object_store: namespace.objectStore || "-",
            data_lake: namespace.dataLake || "-",
          },
        ]);
        p.outro("✓ Done");
      });
    }),
).pipe(
  Command.withDescription("Create a new namespace belonging to a tenant"),
  Command.provide(({ host, port }) => makeClusterClientLayer(host, port)),
);
