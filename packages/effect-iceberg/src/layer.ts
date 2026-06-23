import type { IcebergRestCatalogOptions } from "iceberg-js";

import { Config, Effect, Layer } from "effect";

import { IcebergCatalog, make } from "./service";

/**
 * Creates an `IcebergCatalog` layer from concrete `iceberg-js` catalog options.
 *
 * @example
 * ```typescript
 * const IcebergLive = layer({
 *   baseUrl: "https://catalog.example.com",
 *   warehouse: "warehouse",
 *   auth: { type: "bearer", token: "..." },
 * });
 * ```
 */
export const layer = (options: IcebergRestCatalogOptions) =>
  Layer.succeed(IcebergCatalog)(make(options));

/**
 * Creates an `IcebergCatalog` layer from Effect `Config` values.
 *
 * @example
 * ```typescript
 * const IcebergLive = layerConfig({
 *   baseUrl: Config.string("ICEBERG_REST_URL"),
 *   warehouse: Config.string("ICEBERG_WAREHOUSE"),
 * });
 * ```
 */
export const layerConfig = (config: Config.Wrap<IcebergRestCatalogOptions>) =>
  Layer.effect(
    IcebergCatalog,
    Effect.gen(function* () {
      const options = yield* Config.unwrap(config);
      return make(options);
    }),
  );
