import type { PartitionValue } from "@useairfoil/wings";
import * as Wings from "@useairfoil/wings";
import { Effect, Layer } from "effect";
import { ConnectorError } from "../core/errors";
import type { ConnectorDefinition } from "../core/types";
import { Publisher } from "./service";

type Rows = Record<string, unknown>;

export type WingsPublisherConfig = {
  readonly connector: ConnectorDefinition;
  /** Map of entity/event name to Wings topic. */
  readonly topics: Record<string, Wings.Cluster.Topic.Topic>;
  /** per-stream partition value (key is entity/event name). */
  readonly partitionValues?: Record<string, PartitionValue>;
};

/** Publisher entry for a single entity/event. */
type PublisherEntry = {
  /** Wings publisher for the entity/event. */
  readonly publisher: Wings.WingsClient.Publisher;
  /** Partition field name (if any). */
  readonly partitionField?: string;
  /** Partition value (if any). */
  readonly partitionValue?: PartitionValue;
};

// remove the partition key from rows, as wings requires it separately.
const stripPartitionField = (
  rows: ReadonlyArray<Rows>,
  field?: string,
): Array<Rows> => {
  if (!field) {
    return Array.from(rows);
  }

  return rows.map((row) => {
    const { [field]: _value, ...rest } = row;
    return rest;
  });
};

const buildRecordBatch = (rows: ReadonlyArray<Rows>) => {
  // Convert JSON rows into an Arrow RecordBatch for Wings.
  const table = Wings.tableFromJSON(Array.from(rows));
  const [batch] = table.batches;

  if (!batch) {
    throw new ConnectorError({ message: "No rows to publish" });
  }

  return batch;
};

export const WingsPublisherLayer = (
  config: WingsPublisherConfig,
): Layer.Layer<Publisher, ConnectorError, Wings.WingsClient.WingsClient> =>
  Layer.effect(
    Publisher,
    Effect.gen(function* () {
      const entries = new Map<string, PublisherEntry>();

      // create and store a wings publisher for each entity/event.
      for (const def of [
        ...config.connector.entities,
        ...config.connector.events,
      ]) {
        const topic = config.topics[def.name];
        if (!topic) {
          return yield* Effect.fail(
            new ConnectorError({ message: `Missing topic for ${def.name}` }),
          );
        }

        const partitionIndex =
          topic.partitionKey !== undefined
            ? topic.schema.fields.findIndex(
                (field) => field.id === topic.partitionKey,
              )
            : undefined;

        const partitionField =
          partitionIndex !== undefined && partitionIndex >= 0
            ? topic.schema.fields[partitionIndex]?.name
            : undefined;

        const publisher = yield* Wings.WingsClient.publisher({
          topic,
          partitionValue: config.partitionValues?.[def.name],
        }).pipe(
          Effect.mapError(
            (error) =>
              new ConnectorError({ message: error.message, cause: error }),
          ),
        );

        entries.set(def.name, {
          publisher,
          partitionField,
          partitionValue: config.partitionValues?.[def.name],
        });
      }

      return {
        publish: ({ name, batch }) =>
          Effect.gen(function* () {
            const entry = entries.get(name);
            if (!entry) {
              return yield* Effect.fail(
                new ConnectorError({ message: `Unknown stream ${name}` }),
              );
            }

            const rowObjects = batch.rows as ReadonlyArray<Rows>;
            const rows = stripPartitionField(rowObjects, entry.partitionField);
            const recordBatch = buildRecordBatch(rows);
            const result = yield* entry.publisher
              .push({
                batch: recordBatch,
                partitionValue: entry.partitionValue,
              })
              .pipe(
                Effect.mapError(
                  (error) =>
                    new ConnectorError({
                      message: error.message,
                      cause: error,
                    }),
                ),
              );

            return {
              success: !!(result.result && result.result.$case === "accepted"),
            };
          }),
      };
    }),
  );
