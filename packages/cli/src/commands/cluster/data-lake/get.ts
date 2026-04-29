import * as p from "@clack/prompts";
import { ClusterClient } from "@useairfoil/wings";
import { printTable } from "console-table-printer";
import { Effect } from "effect";
import { Command, Flag } from "effect/unstable/cli";

import { makeClusterClientLayer } from "../../../utils/client";
import { hostOption, portOption } from "../../../utils/options";

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
  ({ name }) =>
    Effect.gen(function* () {
      const s = p.spinner();
      s.start("Fetching data lake...");

      const dataLake = yield* ClusterClient.getDataLake({ name }).pipe(
        Effect.tapError(() => Effect.sync(() => s.stop("Failed to get data lake"))),
      );

      s.stop("Data lake retrieved");

      yield* Effect.sync(() => {
        printTable([{ name: dataLake.name, type: dataLake.dataLakeConfig._tag || "-" }]);
        p.outro("✓ Done");
      });
    }),
).pipe(
  Command.withDescription("Get details of a specific data lake"),
  Command.provide(({ host, port }) => makeClusterClientLayer(host, port)),
);
