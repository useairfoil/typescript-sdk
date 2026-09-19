import { Effect, Layer } from "effect";

import { Ingestor } from "./service";

/** Logs batches without sending them to Wings. */
export const layerConsole = Layer.succeed(Ingestor)({
  ingest: ({ resource, source, batch }) =>
    Effect.logInfo(`[ingestor] -> Source: ${source} | Resource: ${resource}`).pipe(
      Effect.annotateLogs({ rows: batch.rows.length, cursor: batch.cursor, source }),
    ),
});
