import * as p from "@clack/prompts";
import { WingsClusterMetadata } from "@useairfoil/wings";
import { printTable } from "console-table-printer";
import { Effect, Option } from "effect";
import { Command, Flag } from "effect/unstable/cli";
import { makeClusterMetadataLayer } from "../../../utils/client.js";
import { handleCliError } from "../../../utils/effect.js";
import {
  hostOption,
  pageSizeOption,
  pageTokenOption,
  portOption,
} from "../../../utils/options.js";

const parentOption = Flag.string("parent").pipe(
  Flag.withDescription("Parent tenant in format: tenants/{tenant}"),
);

export const listDataLakesCommand = Command.make(
  "list-data-lakes",
  {
    parent: parentOption,
    pageSize: pageSizeOption,
    pageToken: pageTokenOption,
    host: hostOption,
    port: portOption,
  },
  ({ parent, pageSize, pageToken, host, port }) =>
    Effect.gen(function* () {
      const layer = makeClusterMetadataLayer(host, port);

      const s = p.spinner();
      s.start("Fetching data lakes...");

      const response = yield* WingsClusterMetadata.listDataLakes({
        parent,
        pageSize,
        pageToken: Option.getOrUndefined(pageToken),
      }).pipe(
        Effect.provide(layer),
        Effect.tapError(() =>
          Effect.sync(() => s.stop("Failed to list data lakes")),
        ),
      );

      s.stop(`Found ${response.dataLakes.length} data lake(s)`);

      yield* Effect.sync(() => {
        if (response.dataLakes.length === 0) {
          p.log.warn("No data lakes found");
        } else {
          printTable(
            response.dataLakes.map(
              (dataLake: {
                name: string;
                dataLakeConfig: { _tag?: string | null };
              }) => ({
                name: dataLake.name,
                type: dataLake.dataLakeConfig._tag || "-",
              }),
            ),
          );
        }

        if (response.nextPageToken) {
          p.log.info(`Next page token: ${response.nextPageToken}`);
        }

        p.outro("✓ Done");
      });
    }).pipe(Effect.catch(handleCliError("Failed to list data lakes"))),
).pipe(Command.withDescription("List all data lakes belonging to a tenant"));
