import { readFileSync } from "node:fs";
import * as p from "@clack/prompts";
import { Args, Command, Options } from "@effect/cli";
import { ArrowFlightSqlClient } from "@useairfoil/flight";
import { printTable } from "console-table-printer";
import { Effect, Option } from "effect";
import { Metadata } from "nice-grpc-common";
import { handleCliError } from "../utils/effect.js";
import { hostOption, portOption } from "../utils/options.js";

const queryArg = Args.text({ name: "query" }).pipe(
  Args.withDescription("SQL query to execute"),
  Args.optional,
);

const fileOption = Options.text("file").pipe(
  Options.withAlias("f"),
  Options.withDescription("Execute SQL from file"),
  Options.optional,
);

const namespaceOption = Options.text("namespace").pipe(
  Options.withAlias("n"),
  Options.withDescription("Wings namespace"),
  Options.withDefault("tenants/default/namespaces/default"),
);

const jsonOption = Options.boolean("json").pipe(
  Options.withDescription("Output results as JSON"),
  Options.withDefault(false),
);

export const sqlCommand = Command.make(
  "sql",
  {
    query: queryArg,
    host: hostOption,
    port: portOption,
    file: fileOption,
    namespace: namespaceOption,
    json: jsonOption,
  },
  ({ query, host, port, file, namespace, json }) =>
    Effect.gen(function* () {
      let sqlQuery = Option.getOrUndefined(query);
      const filePath = Option.getOrUndefined(file);

      if (filePath) {
        sqlQuery = yield* Effect.try({
          try: () => readFileSync(filePath, "utf-8"),
          catch: (error) =>
            new Error(
              `Failed to read file: ${error instanceof Error ? error.message : "Unknown error"}`,
            ),
        });
      }

      if (!sqlQuery) {
        return yield* Effect.fail(
          new Error(
            "No query provided. Use a query argument or --file option.",
          ),
        );
      }

      const hostPort = `${host}:${port}`;

      p.intro("🔍 Arrow Flight SQL");
      p.log.info(`Connecting to: ${hostPort}`);
      p.log.info(`Namespace: ${namespace}`);

      const client = new ArrowFlightSqlClient(
        {
          host: hostPort,
        },
        {
          defaultCallOptions: {
            "*": {
              metadata: Metadata({
                "x-wings-namespace": namespace,
              }),
            },
          },
        },
      );

      const s = p.spinner();
      s.start("Executing query...");

      const flightInfo = yield* Effect.tryPromise({
        try: () => client.executeQuery({ query: sqlQuery }),
        catch: (error) =>
          error instanceof Error ? error : new Error("Query failed"),
      }).pipe(Effect.tapError(() => Effect.sync(() => s.stop("Query failed"))));

      const batches = yield* Effect.tryPromise({
        try: () => Array.fromAsync(client.executeFlightInfo(flightInfo)),
        catch: (error) =>
          error instanceof Error ? error : new Error("Query failed"),
      }).pipe(Effect.tapError(() => Effect.sync(() => s.stop("Query failed"))));

      const data = batches.flatMap((batch) => batch.toArray());

      s.stop(`Query executed: ${sqlQuery}`);

      yield* Effect.sync(() => {
        if (json) {
          console.log(JSON.stringify(data, null, 2));
        } else if (data.length === 0) {
          p.log.warn("No results returned");
        } else {
          printTable(data, {
            defaultColumnOptions: {
              alignment: "left",
            },
          });
        }
        p.outro("✓ Done");
      });
    }).pipe(Effect.catchAll(handleCliError("Command failed"))),
).pipe(Command.withDescription("Execute SQL queries using Arrow Flight SQL"));
