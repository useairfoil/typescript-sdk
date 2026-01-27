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
    "Data lake name in format: tenants/{tenant}/data-lakes/{data-lake}",
  ),
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
        Effect.tapError(() =>
          Effect.sync(() => s.stop("Failed to get data lake")),
        ),
      );

      s.stop("Data lake retrieved");

      yield* Effect.sync(() => {
        printTable([
          { name: dataLake.name, type: dataLake.dataLakeConfig._tag || "-" },
        ]);
        p.outro("✓ Done");
      });
    }).pipe(Effect.catchAll(handleCliError("Failed to get data lake"))),
).pipe(Command.withDescription("Get details of a specific data lake"));
