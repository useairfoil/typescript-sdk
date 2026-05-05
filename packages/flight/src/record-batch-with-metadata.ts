import type { RecordBatch, TypeMap } from "apache-arrow";

export type RecordBatchWithMetadata<T extends TypeMap = any> = {
  readonly batch: RecordBatch<T>;
  readonly appMetadata: Uint8Array;
};
