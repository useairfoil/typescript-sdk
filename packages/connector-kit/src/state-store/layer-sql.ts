import { Config, Effect, Layer } from "effect";
import { KeyValueStore } from "effect/unstable/persistence";
import { SqlClient } from "effect/unstable/sql";

import type { StateStore } from "./service";

import { PlatformRuntimeKey } from "../runtime-config/constants";
import { connectorInstanceKeyPrefix } from "./keys";
import { layerKeyValueStore } from "./layer-key-value-store";

const scopedKeyValueStore = (connectorInstanceId: string) =>
  Layer.effect(KeyValueStore.KeyValueStore)(
    KeyValueStore.KeyValueStore.pipe(
      Effect.map(KeyValueStore.prefix(connectorInstanceKeyPrefix(connectorInstanceId))),
    ),
  );

/**
 * Shared SQL state using the table and immutable connector instance ID supplied
 * by platform-owned Effect configuration. Effect's SQL KeyValueStore owns the
 * table, while `KeyValueStore.prefix` provides application-level isolation
 * between connector instances in that table. The resulting layer exposes only
 * StateStore, never the unscoped KeyValueStore.
 *
 * @example
 * ```ts
 * const StateStoreLive = layerSql().pipe(Layer.provide(PostgresLive));
 * ```
 */
export const layerSql = (): Layer.Layer<StateStore, Config.ConfigError, SqlClient.SqlClient> =>
  Layer.unwrap(
    Config.all({
      connectorInstanceId: Config.nonEmptyString(PlatformRuntimeKey.connectorInstanceId),
      table: Config.nonEmptyString(PlatformRuntimeKey.stateTable),
    }).pipe(
      Effect.map(({ connectorInstanceId, table }) =>
        layerKeyValueStore.pipe(
          Layer.provide(
            scopedKeyValueStore(connectorInstanceId).pipe(
              Layer.provide(KeyValueStore.layerSql({ table })),
            ),
          ),
        ),
      ),
    ),
  );
