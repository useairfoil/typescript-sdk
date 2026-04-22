import * as p from "@clack/prompts";
import { WingsClusterMetadata } from "@useairfoil/wings";
import { printTable } from "console-table-printer";
import { Effect } from "effect";
import { Command, Flag } from "effect/unstable/cli";

import { makeClusterMetadataLayer } from "../../../utils/client.js";
import { handleCliError } from "../../../utils/effect.js";
import { hostOption, portOption } from "../../../utils/options.js";

const nameOption = Flag.string("name").pipe(
  Flag.withDescription("Namespace name in format: tenants/{tenant}/namespaces/{namespace}"),
);

export const getNamespaceCommand = Command.make(
  "get-namespace",
  {
    name: nameOption,
    host: hostOption,
    port: portOption,
  },
  ({ name, host, port }) =>
    Effect.gen(function* () {
      const layer = makeClusterMetadataLayer(host, port);

      const s = p.spinner();
      s.start("Fetching namespace...");

      const namespace = yield* WingsClusterMetadata.getNamespace({ name }).pipe(
        Effect.provide(layer),
        Effect.tapError(() => Effect.sync(() => s.stop("Failed to get namespace"))),
      );

      s.stop("Namespace retrieved");

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
    }).pipe(Effect.catch(handleCliError("Failed to get namespace"))),
).pipe(Command.withDescription("Get details of a specific namespace"));
