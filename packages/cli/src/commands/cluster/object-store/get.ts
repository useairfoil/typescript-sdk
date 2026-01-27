import { WingsClusterMetadata } from "@airfoil/wings";
import * as p from "@clack/prompts";
import { Command, Options } from "@effect/cli";
import { printTable } from "console-table-printer";
import { Effect } from "effect";
import { makeClusterMetadataLayer } from "../../../utils/client.js";
import { handleCliError } from "../../../utils/effect.js";
import { hostOption, portOption } from "../../../utils/options.js";

const nameOption = Options.text("name").pipe(
  Options.withDescription(
    "Object store name in format: tenants/{tenant}/object-stores/{object-store}",
  ),
);

export const getObjectStoreCommand = Command.make(
  "get-object-store",
  {
    name: nameOption,
    host: hostOption,
    port: portOption,
  },
  ({ name, host, port }) =>
    Effect.gen(function* () {
      const layer = makeClusterMetadataLayer(host, port);

      const s = p.spinner();
      s.start("Fetching object store...");

      const objectStore = yield* WingsClusterMetadata.getObjectStore({
        name,
      }).pipe(
        Effect.provide(layer),
        Effect.tapError(() =>
          Effect.sync(() => s.stop("Failed to get object store")),
        ),
      );

      s.stop("Object store retrieved");

      yield* Effect.sync(() => {
        printTable([
          {
            name: objectStore.name,
            type: objectStore.objectStoreConfig._tag || "-",
          },
        ]);
        p.outro("✓ Done");
      });
    }).pipe(Effect.catchAll(handleCliError("Failed to get object store"))),
).pipe(Command.withDescription("Get details of a specific object store"));
