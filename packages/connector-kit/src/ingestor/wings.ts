import type { RecordBatch, TypeMap } from "apache-arrow";
import type { TableIdentifier } from "iceberg-js";

import * as Wings from "@useairfoil/wings";
import { Config, Effect, Layer } from "effect";
import { FetchHttpClient } from "effect/unstable/http";

import type { ConnectorDefinition } from "../core/types";

import { ensureTable } from "../catalog/table";
import { ConnectorError } from "../errors";
import * as RuntimeConfig from "../runtime-config";
import { makeRowEncoder, type RowEncoder } from "./arrow";
import { Ingestor, type IngestorService } from "./service";

/** One catalog and an Iceberg table for each resource. */
export type WingsIngestorConfig<Connector extends ConnectorDefinition = ConnectorDefinition> = {
  readonly connector: Connector;
  readonly catalog: string;
  readonly tables: RuntimeConfig.ResolvedTableBindings<Connector>;
};

type IngestorEntry = {
  readonly encode: RowEncoder;
  readonly push: (batch: RecordBatch<TypeMap>) => Effect.Effect<void, ConnectorError>;
};

type PreparedTable = {
  readonly resource: string;
  readonly identifier: TableIdentifier;
  readonly encode: RowEncoder;
};

const connectorError = (message: string, cause?: unknown) => new ConnectorError({ message, cause });

/** Loads each table schema and opens one Wings stream per resource. */
export const layerWings = <const Connector extends ConnectorDefinition>(
  config: WingsIngestorConfig<Connector>,
): Layer.Layer<Ingestor, ConnectorError, Wings.CatalogManager.CatalogManager> =>
  Layer.effect(Ingestor)(
    Effect.gen(function* () {
      const manager = yield* Wings.CatalogManager.CatalogManager;
      const catalog = yield* manager
        .getIcebergCatalog(config.catalog)
        .pipe(Effect.mapError((cause) => connectorError("Failed to load Wings catalog", cause)));

      // `tables` only covers every resource when the connector type is const,
      // so a binding can be missing.
      const bindings: Partial<Record<string, RuntimeConfig.TableBinding>> = config.tables;

      const prepared: Array<PreparedTable> = [];
      for (const resource of config.connector.resources) {
        const binding = bindings[resource.name];

        if (!binding) {
          return yield* Effect.fail(connectorError(`Missing table binding for ${resource.name}`));
        }

        const { namespace, name, location } = binding;
        const identifier = { namespace, name };
        const schema = yield* ensureTable(resource.rowSchema, {
          catalog,
          identifier,
          location,
        }).pipe(
          Effect.mapError((cause) =>
            connectorError(`Failed to prepare table for ${resource.name}: ${cause.message}`, cause),
          ),
        );

        const encode = yield* makeRowEncoder(schema, resource.key, resource.version);
        prepared.push({ resource: resource.name, identifier, encode });
      }

      const entries = new Map<string, IngestorEntry>();
      for (const { resource, identifier, encode } of prepared) {
        const ingestor = yield* manager
          .ingestor({
            catalog: config.catalog,
            namespace: identifier.namespace,
            table: identifier.name,
          })
          .pipe(
            Effect.mapError((cause) =>
              connectorError(`Failed to open ingestor for ${resource}`, cause),
            ),
          );

        entries.set(resource, {
          encode,
          push: (batch) =>
            ingestor
              .push(batch)
              .pipe(
                Effect.mapError((cause) =>
                  connectorError(`Failed to ingest rows for ${resource}`, cause),
                ),
              ),
        });
      }

      const service: IngestorService = {
        ingest: ({ resource, batch }) => {
          const entry = entries.get(resource);

          if (!entry) return Effect.fail(connectorError(`Unknown resource ${resource}`));
          if (batch.rows.length === 0) return Effect.void;

          return entry.encode(batch.rows).pipe(Effect.flatMap(entry.push));
        },
      };

      return Ingestor.of(service);
    }),
  );

/** Reads the Wings URL, catalog and table bindings from hosted config. */
export const layerWingsConfig = (connector: ConnectorDefinition) =>
  Layer.unwrap(
    Effect.gen(function* () {
      const { catalog, uri } = yield* Config.all({
        catalog: RuntimeConfig.catalog,
        uri: RuntimeConfig.wingsUri,
      }).pipe(Effect.mapError((cause) => connectorError("Invalid Wings configuration", cause)));

      if (uri.protocol !== "http:" && uri.protocol !== "https:") {
        return yield* Effect.fail(connectorError("Invalid Wings URL"));
      }

      const tables = yield* RuntimeConfig.loadTableBindings(connector).pipe(
        Effect.mapError((cause) => connectorError(cause.message, cause)),
      );
      const manager = Wings.CatalogManager.layer({ baseUrl: uri.href }).pipe(
        Layer.provide(FetchHttpClient.layer),
      );

      return layerWings({ connector, catalog, tables }).pipe(Layer.provide(manager));
    }),
  );
