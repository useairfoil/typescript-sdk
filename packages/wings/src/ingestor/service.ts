import type { RecordBatch } from "@useairfoil/flight";
import type { Effect } from "effect";

import type { IngestorError } from "./error";

/** The Wings table to ingest into. */
export interface IngestorOptions {
  readonly catalog: string;
  readonly namespace: string[];
  readonly table: string;
}

/** A scoped stream that sends batches to one Wings table. */
export interface Ingestor {
  /** Sends a batch and waits for its acknowledgement. */
  readonly push: (batch: RecordBatch) => Effect.Effect<void, IngestorError>;
}
