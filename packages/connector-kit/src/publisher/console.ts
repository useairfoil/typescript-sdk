import { Effect, Layer } from "effect";

import { Publisher } from "./service";

export const layerConsole = Layer.succeed(Publisher)({
  publish: ({ name, source, batch }) =>
    Effect.gen(function* () {
      const ids = batch.rows.map((row) => row["id"]).filter((id) => id != null);

      yield* Effect.logInfo(`[publisher] -> Source: ${source} | Name: ${name}`).pipe(
        Effect.annotateLogs({
          count: batch.rows.length,
          ids,
          cursor: batch.cursor,
          source,
        }),
      );

      return { success: true };
    }),
});
