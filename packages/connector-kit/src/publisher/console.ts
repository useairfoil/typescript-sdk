import { Effect, Layer } from "effect";

import { Publisher } from "./service";

export const layerConsole = Layer.succeed(Publisher)({
  publish: ({ resource, source, batch }) =>
    Effect.gen(function* () {
      yield* Effect.logInfo(`[publisher] -> Source: ${source} | Resource: ${resource}`).pipe(
        Effect.annotateLogs({
          mutations: batch.mutations.length,
          cursor: batch.cursor,
          source,
        }),
      );

      return { status: "accepted" as const, resource };
    }),
});
