import * as p from "@clack/prompts";
import { WingsClusterMetadata } from "@useairfoil/wings";
import { printTable } from "console-table-printer";
import { Effect } from "effect";
import { Command, Flag } from "effect/unstable/cli";

import { makeClusterMetadataLayer } from "../../../utils/client.js";
import { handleCliError } from "../../../utils/effect.js";
import { hostOption, portOption } from "../../../utils/options.js";

const parentOption = Flag.string("parent").pipe(
  Flag.withDescription("Parent tenant in format: tenants/{tenant}"),
);

const dataLakeIdOption = Flag.string("data-lake-id").pipe(
  Flag.withDescription("Unique identifier for the data lake"),
);

export const createDataLakeParquetCommand = Command.make(
  "parquet",
  {
    parent: parentOption,
    dataLakeId: dataLakeIdOption,
    host: hostOption,
    port: portOption,
  },
  ({ parent, dataLakeId, host, port }) =>
    Effect.gen(function* () {
      p.intro("🏞️  Create Parquet Data Lake");

      const layer = makeClusterMetadataLayer(host, port);

      const s = p.spinner();
      s.start("Creating Parquet data lake...");

      const result = yield* WingsClusterMetadata.createDataLake({
        parent,
        dataLakeId,
        dataLakeConfig: {
          _tag: "parquet",
          parquet: {},
        },
      }).pipe(
        Effect.provide(layer),
        Effect.tapError(() => Effect.sync(() => s.stop("Failed to create data lake"))),
      );

      s.stop("Parquet data lake created successfully");

      yield* Effect.sync(() => {
        printTable([
          {
            name: result.name,
            type: "Parquet",
          },
        ]);
        p.outro("✓ Done");
      });
    }).pipe(Effect.catch(handleCliError("Failed to create data lake"))),
).pipe(Command.withDescription("Create a new Parquet data lake"));
