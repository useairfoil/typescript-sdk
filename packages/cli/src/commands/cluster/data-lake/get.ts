import * as p from "@clack/prompts";
import { WingsClusterMetadata } from "@useairfoil/wings";
import { printTable } from "console-table-printer";
import { Effect } from "effect";
import { Command, Flag } from "effect/unstable/cli";

import { makeClusterMetadataLayer } from "../../../utils/client.js";
import { hostOption, portOption } from "../../../utils/options.js";

const nameOption = Flag.string("name").pipe(
  Flag.withDescription("Data lake name in format: tenants/{tenant}/data-lakes/{data-lake}"),
);

export const getDataLakeCommand = Command.make(
  "get-data-lake",
  {
    name: nameOption,
    host: hostOption,
    port: portOption,
  },
  ({ name, host, port }) =>
    Effect.gen(function* () {
      const layer = makeClusterMetadataLayer(host, port);

      const s = p.spinner();
      s.start("Fetching data lake...");

      const dataLake = yield* WingsClusterMetadata.getDataLake({ name }).pipe(
        Effect.provide(layer),
        Effect.tapError(() => Effect.sync(() => s.stop("Failed to get data lake"))),
      );

      s.stop("Data lake retrieved");

      yield* Effect.sync(() => {
        printTable([{ name: dataLake.name, type: dataLake.dataLakeConfig._tag || "-" }]);
        p.outro("✓ Done");
      });
    }),
).pipe(Command.withDescription("Get details of a specific data lake"));
