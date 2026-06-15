import * as Wings from "@useairfoil/wings";
import { Effect, Layer } from "effect";

import type { ConnectorDefinition, ResourceDefinition } from "../core/types";

import { ConnectorError } from "../errors";
import { SpanName } from "../telemetry";
import { Publisher, type PublishAck, type PublisherService } from "./service";

type Rows = Record<string, unknown>;

export type WingsTableMapping = {
  readonly name: string;
  readonly partitionValue?: Wings.PartitionValue.PartitionValue;
};

export type WingsPublisherConfig = {
  readonly connector: ConnectorDefinition;
  readonly tables: Record<string, string | WingsTableMapping>;
};

type PublisherEntry = {
  readonly resource: ResourceDefinition;
  readonly table: Wings.Cluster.Table.Table;
  readonly publisher: Wings.WingsClient.Publisher;
  readonly partitionValue?: Wings.PartitionValue.PartitionValue;
  readonly keyField: Wings.Cluster.ArrowType.Field;
  readonly versionField: Wings.Cluster.ArrowType.Field;
};

const normalizeMapping = (mapping: string | WingsTableMapping): WingsTableMapping =>
  typeof mapping === "string" ? { name: mapping } : mapping;

const buildRecordBatch = (rows: ReadonlyArray<Rows>) => {
  const table = Wings.Arrow.tableFromJSON(Array.from(rows));
  const [batch] = table.batches;
  return batch
    ? Effect.succeed(batch)
    : Effect.fail(new ConnectorError({ message: "No rows to publish" }));
};

const validateTableMapping = (options: {
  readonly resource: ResourceDefinition;
  readonly table: Wings.Cluster.Table.Table;
  readonly partitionValue?: Wings.PartitionValue.PartitionValue;
}) =>
  Effect.try({
    try: () => {
      const keyField = Wings.TableUtils.getKeyField(options.table);
      const versionField = Wings.TableUtils.getVersionField(options.table);
      const partitionField = Wings.TableUtils.getPartitionField(options.table);

      if (keyField.name !== options.resource.key) {
        throw new Error(
          `Resource ${options.resource.name} key '${options.resource.key}' does not match Wings table key '${keyField.name}'`,
        );
      }
      if (versionField.name !== options.resource.version) {
        throw new Error(
          `Resource ${options.resource.name} version '${options.resource.version}' does not match Wings table version '${versionField.name}'`,
        );
      }
      if (options.resource.partition?.required === true && !options.partitionValue) {
        throw new Error(`Resource ${options.resource.name} requires a partition value`);
      }
      if (partitionField && !options.partitionValue) {
        throw new Error(
          `Wings table ${options.table.name} is partitioned but no partition value was provided`,
        );
      }
      if (!partitionField && options.partitionValue) {
        throw new Error(
          `Wings table ${options.table.name} is not partitioned but a partition value was provided`,
        );
      }

      return { keyField, versionField };
    },
    catch: (cause) =>
      new ConnectorError({
        message: `Invalid Wings table mapping for ${options.resource.name}`,
        cause,
      }),
  });

const accepted = (entry: PublisherEntry): PublishAck => ({
  status: "accepted",
  resource: entry.resource.name,
  partition: entry.partitionValue,
});

const rejected = (entry: PublisherEntry, reason: string, rejectedRows: number): PublishAck => ({
  status: "rejected",
  resource: entry.resource.name,
  reason,
  rejectedRows,
  partition: entry.partitionValue,
});

export const layerWings = (
  config: WingsPublisherConfig,
): Layer.Layer<Publisher, ConnectorError, Wings.WingsClient.WingsClient> =>
  Layer.effect(Publisher)(
    Effect.gen(function* () {
      const entries = new Map<string, PublisherEntry>();
      const clusterClient = yield* Wings.WingsClient.clusterClient;

      for (const resource of config.connector.resources) {
        const mappingInput = config.tables[resource.name];
        if (!mappingInput) {
          return yield* Effect.fail(
            new ConnectorError({ message: `Missing table for ${resource.name}` }),
          );
        }

        const mapping = normalizeMapping(mappingInput);
        const table = yield* clusterClient.getTable({ name: mapping.name }).pipe(
          Effect.mapError(
            (error) =>
              new ConnectorError({
                message: `Failed to resolve Wings table for ${resource.name}`,
                cause: error,
              }),
          ),
        );
        const { keyField, versionField } = yield* validateTableMapping({
          resource,
          table,
          partitionValue: mapping.partitionValue,
        });

        const publisher = yield* Wings.WingsClient.publisher({
          table,
          partitionValue: mapping.partitionValue,
        }).pipe(
          Effect.mapError((error) => new ConnectorError({ message: error.message, cause: error })),
        );

        entries.set(resource.name, {
          resource,
          table,
          publisher,
          partitionValue: mapping.partitionValue,
          keyField,
          versionField,
        });
      }

      const pushRows = (
        entry: PublisherEntry,
        operation: "upsert" | "delete",
        rows: ReadonlyArray<Rows>,
      ) =>
        Effect.gen(function* () {
          if (rows.length === 0) return accepted(entry);
          const batch = yield* buildRecordBatch(rows);
          return yield* entry.publisher
            .push({ operation, batch, partitionValue: entry.partitionValue })
            .pipe(
              Effect.matchEffect({
                onFailure: (error) => Effect.succeed(rejected(entry, error.message, rows.length)),
                onSuccess: () => Effect.succeed(accepted(entry)),
              }),
            );
        });

      const service: PublisherService = {
        publish: Effect.fn(SpanName.publish, { kind: "producer" })(function* ({
          resource,
          source: _source,
          batch,
        }) {
          const entry = entries.get(resource);
          if (!entry) {
            return yield* Effect.fail(
              new ConnectorError({ message: `Unknown resource ${resource}` }),
            );
          }

          if (batch.mutations.length === 0) return accepted(entry);

          const upserts: Rows[] = [];
          const deletes: Rows[] = [];
          for (const mutation of batch.mutations) {
            if (mutation.op === "upsert") {
              upserts.push(mutation.row as Rows);
            } else {
              deletes.push({
                [entry.keyField.name]: mutation.key,
                [entry.versionField.name]: mutation.version,
              });
            }
          }

          const upsertAck = yield* pushRows(entry, "upsert", upserts);
          if (upsertAck.status === "rejected") return upsertAck;

          return yield* pushRows(entry, "delete", deletes);
        }),
      };

      return Publisher.of(service);
    }),
  );
