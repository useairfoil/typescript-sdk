import { WingsClusterMetadata } from "@airfoil/wings";
import * as p from "@clack/prompts";
import { Command, Options } from "@effect/cli";
import { printTable } from "console-table-printer";
import { Effect } from "effect";
import { makeClusterMetadataLayer } from "../../../utils/client.js";
import { handleCliError } from "../../../utils/effect.js";
import { hostOption, portOption } from "../../../utils/options.js";

const parentOption = Options.text("parent").pipe(
  Options.withDescription(
    "Parent tenant in format: tenants/{tenant} (e.g., 'tenants/default')",
  ),
);

const namespaceIdOption = Options.text("namespace-id").pipe(
  Options.withDescription(
    "Unique identifier for the namespace (e.g., 'production')",
  ),
);

const flushSizeBytesOption = Options.integer("flush-size-bytes").pipe(
  Options.withDescription(
    "Size at which the current segment is flushed to object storage",
  ),
  Options.withDefault(0),
);

const flushIntervalMillisOption = Options.integer("flush-interval-millis").pipe(
  Options.withDescription(
    "Maximum interval at which the current segment is flushed (milliseconds)",
  ),
  Options.withDefault(0),
);

const objectStoreOption = Options.text("object-store").pipe(
  Options.withDescription(
    "Object store used by this namespace (format: tenants/{tenant}/object-stores/{object-store})",
  ),
);

const dataLakeOption = Options.text("data-lake").pipe(
  Options.withDescription(
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
  ({
    parent,
    namespaceId,
    flushSizeBytes,
    flushIntervalMillis,
    objectStore,
    dataLake,
    host,
    port,
  }) =>
    Effect.gen(function* () {
      p.intro("📁 Create Namespace");

      const layer = makeClusterMetadataLayer(host, port);

      const s = p.spinner();
      s.start("Creating namespace...");

      const namespace = yield* WingsClusterMetadata.createNamespace({
        parent,
        namespaceId,
        flushSizeBytes: BigInt(flushSizeBytes),
        flushIntervalMillis: BigInt(flushIntervalMillis),
        objectStore,
        dataLake,
      }).pipe(
        Effect.provide(layer),
        Effect.tapError(() =>
          Effect.sync(() => s.stop("Failed to create namespace")),
        ),
      );

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
    }).pipe(Effect.catchAll(handleCliError("Failed to create namespace"))),
).pipe(Command.withDescription("Create a new namespace belonging to a tenant"));
