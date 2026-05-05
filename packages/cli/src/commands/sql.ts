import { ArrowFlightSqlClient } from "@useairfoil/flight";
import { printTable } from "console-table-printer";
import { Effect, FileSystem, Option, Stream } from "effect";
import { Argument, Command, Flag } from "effect/unstable/cli";
import { Metadata } from "nice-grpc-common";

import { hostOption, portOption } from "../utils/options";

const queryArg = Argument.string("query").pipe(
  Argument.withDescription("SQL query to execute"),
  Argument.optional,
);

const fileOption = Flag.string("file").pipe(
  Flag.withAlias("f"),
  Flag.withDescription("Execute SQL from file"),
  Flag.optional,
);

const namespaceOption = Flag.string("namespace").pipe(
  Flag.withAlias("n"),
  Flag.withDescription("Wings namespace"),
  Flag.withDefault("tenants/default/namespaces/default"),
);

const jsonOption = Flag.boolean("json").pipe(
  Flag.withDescription("Output results as JSON"),
  Flag.withDefault(false),
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
      const fs = yield* FileSystem.FileSystem;
      let sqlQuery = Option.getOrUndefined(query);
      const filePath = Option.getOrUndefined(file);

      if (filePath) {
        sqlQuery = yield* fs.readFileString(filePath);
      }

      if (!sqlQuery) {
        return yield* Effect.fail(
          new Error("No query provided. Use a query argument or --file option."),
        );
      }

      const hostPort = `${host}:${port}`;

      yield* Effect.logInfo(`Namespace: ${namespace}`);

      const client = yield* ArrowFlightSqlClient.make({
        host: hostPort,
        defaultCallOptions: {
          "*": {
            metadata: Metadata({
              "x-wings-namespace": namespace,
            }),
          },
        },
      });

      const flightInfo = yield* client.executeQuery({ query: sqlQuery });

      const batches = yield* client.executeFlightInfo(flightInfo).pipe(Stream.runCollect);

      const data = Array.from(batches).flatMap(({ batch }) => batch.toArray());

      if (json) {
        yield* Effect.log(JSON.stringify(data, null, 2));
      } else if (data.length === 0) {
        yield* Effect.logWarning("No results returned");
      } else {
        printTable(data, {
          defaultColumnOptions: {
            alignment: "left",
          },
        });
      }
    }),
).pipe(Command.withDescription("Execute SQL queries using Arrow Flight SQL"));
