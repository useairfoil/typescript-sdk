import * as p from "@clack/prompts";
import { ClusterClient } from "@useairfoil/wings";
import { printTable } from "console-table-printer";
import { Effect } from "effect";
import { Command, Flag } from "effect/unstable/cli";

import { makeClusterClientLayer } from "../../../utils/client";
import { hostOption, portOption } from "../../../utils/options";

const nameOption = Flag.string("name").pipe(
  Flag.withDescription(
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
  ({ name }) =>
    Effect.gen(function* () {
      const s = p.spinner();
      s.start("Fetching object store...");

      const objectStore = yield* ClusterClient.getObjectStore({ name }).pipe(
        Effect.tapError(() => Effect.sync(() => s.stop("Failed to get object store"))),
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
    }),
).pipe(
  Command.withDescription("Get details of a specific object store"),
  Command.provide(({ host, port }) => makeClusterClientLayer(host, port)),
);
