import * as Wings from "@useairfoil/wings";
import { Effect, Layer } from "effect";

import type { ConnectorDefinition } from "../core/types";

import { ConnectorError } from "../errors";
import { Publisher, type PublisherService } from "./service";

type Rows = Record<string, unknown>;

export type WingsPublisherConfig = {
  readonly connector: ConnectorDefinition;
  /** Map of entity/event name to Wings topic. */
  readonly topics: Record<string, Wings.Cluster.Topic.Topic>;
  /** per-stream partition value (key is entity/event name). */
  readonly partitionValues?: Record<string, Wings.PartitionValue.PartitionValue>;
};

/** Publisher entry for a single entity/event. */
type PublisherEntry = {
  /** Wings publisher for the entity/event. */
  readonly publisher: Wings.WingsClient.Publisher;
  /** Partition field name (if any). */
  readonly partitionField?: string;
  /** Partition value (if any). */
  readonly partitionValue?: Wings.PartitionValue.PartitionValue;
};

/** Convert JSON rows into an Arrow RecordBatch for Wings. Returns a typed failure if rows are empty. */
const buildRecordBatch = (rows: ReadonlyArray<Rows>) => {
  const table = Wings.Arrow.tableFromJSON(Array.from(rows));
  const [batch] = table.batches;
  return batch
    ? Effect.succeed(batch)
    : Effect.fail(new ConnectorError({ message: "No rows to publish" }));
};

export const layerWings = (
  config: WingsPublisherConfig,
): Layer.Layer<Publisher, ConnectorError, Wings.WingsClient.WingsClient> =>
  Layer.effect(Publisher)(
    Effect.gen(function* () {
      const entries = new Map<string, PublisherEntry>();

      for (const def of [...config.connector.entities, ...config.connector.events]) {
        const topic = config.topics[def.name];
        if (!topic) {
          return yield* Effect.fail(
            new ConnectorError({ message: `Missing topic for ${def.name}` }),
          );
        }

        const partitionIndex =
          topic.partitionKey !== undefined
            ? topic.schema.fields.findIndex((field) => field.id === topic.partitionKey)
            : undefined;

        const partitionField =
          partitionIndex !== undefined && partitionIndex >= 0
            ? topic.schema.fields[partitionIndex]?.name
            : undefined;

        const publisher = yield* Wings.WingsClient.publisher({
          topic,
          partitionValue: config.partitionValues?.[def.name],
        }).pipe(
          Effect.mapError((error) => new ConnectorError({ message: error.message, cause: error })),
        );

        entries.set(def.name, {
          publisher,
          partitionField,
          partitionValue: config.partitionValues?.[def.name],
        });
      }

      const service: PublisherService = {
        publish: Effect.fn("publisher/publish")(function* ({ name, source: _source, batch }) {
          const entry = entries.get(name);
          if (!entry) {
            return yield* Effect.fail(new ConnectorError({ message: `Unknown stream ${name}` }));
          }

          if (batch.rows.length === 0) {
            return { success: true };
          }

          const recordBatch = yield* buildRecordBatch(batch.rows);
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

      return Publisher.of(service);
    }),
  );
