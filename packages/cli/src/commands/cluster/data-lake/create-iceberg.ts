import * as p from "@clack/prompts";
import { ClusterClient } from "@useairfoil/wings";
import { printTable } from "console-table-printer";
import { Effect } from "effect";
import { Command, Flag } from "effect/unstable/cli";

import { makeClusterClientLayer } from "../../../utils/client";
import { hostOption, portOption } from "../../../utils/options";

const parentOption = Flag.string("parent").pipe(
  Flag.withDescription("Parent tenant in format: tenants/{tenant}"),
);

const dataLakeIdOption = Flag.string("data-lake-id").pipe(
  Flag.withDescription("Unique identifier for the data lake"),
);

export const createDataLakeIcebergCommand = Command.make(
  "iceberg",
  {
    parent: parentOption,
    dataLakeId: dataLakeIdOption,
    host: hostOption,
    port: portOption,
  },
  ({ parent, dataLakeId }) =>
    Effect.gen(function* () {
      p.intro("🏞️  Create Iceberg Data Lake");

      const s = p.spinner();
      s.start("Creating Iceberg data lake...");

      const result = yield* ClusterClient.createDataLake({
        parent,
        dataLakeId,
        dataLakeConfig: {
          _tag: "iceberg",
          iceberg: {},
        },
      }).pipe(Effect.tapError(() => Effect.sync(() => s.stop("Failed to create data lake"))));

      s.stop("Iceberg data lake created successfully");

      yield* Effect.sync(() => {
        printTable([{ name: result.name, type: "Iceberg" }]);
        p.outro("✓ Done");
      });
    }),
).pipe(
  Command.withDescription("Create a new Iceberg data lake"),
  Command.provide(({ host, port }) => makeClusterClientLayer(host, port)),
);
