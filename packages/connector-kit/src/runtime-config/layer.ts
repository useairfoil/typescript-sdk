import { Config, ConfigProvider, Effect, FileSystem, Schema } from "effect";

import { PlatformRuntimeKey } from "./constants";
import { RuntimeConfigError } from "./error";

const providerFromFile: Effect.Effect<
  ConfigProvider.ConfigProvider,
  RuntimeConfigError,
  FileSystem.FileSystem
> = Effect.gen(function* () {
  const configPath = yield* Config.nonEmptyString(PlatformRuntimeKey.configPath).pipe(
    Effect.mapError(
      (error) =>
        new RuntimeConfigError({
          code: "CONFIG_PATH_MISSING",
          message: `${PlatformRuntimeKey.configPath} is required in hosted mode`,
          cause: error.cause,
        }),
    ),
  );
  const fileSystem = yield* FileSystem.FileSystem;
  const contents = yield* fileSystem.readFileString(configPath).pipe(
    Effect.mapError(
      (cause) =>
        new RuntimeConfigError({
          code: "CONFIG_FILE_UNREADABLE",
          message: "Connector config file could not be read",
          cause,
        }),
    ),
  );
  const document = yield* Schema.decodeUnknownEffect(Schema.UnknownFromJsonString)(contents).pipe(
    Effect.mapError(
      (error) =>
        new RuntimeConfigError({
          code: "CONFIG_JSON_INVALID",
          message: "Connector config is not valid JSON",
          cause: error,
        }),
    ),
  );
  return ConfigProvider.fromUnknown(document, { preserveEmptyStrings: true });
});

/**
 * Loads the required JSON file and lets environment values override it per key.
 * Connector field validation remains in the connector's Effect Config.
 *
 * @example
 * ```ts
 * program.pipe(Effect.provide(layerHosted()));
 * ```
 */
export const layerHosted = () => ConfigProvider.layerAdd(providerFromFile);
