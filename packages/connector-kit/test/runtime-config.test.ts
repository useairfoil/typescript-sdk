import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Config, ConfigProvider, Effect, Exit, FileSystem, Redacted } from "effect";

import * as RuntimeConfig from "../src/runtime-config";

describe("runtime config", () => {
  it.effect("classifies a missing path and an unreadable file", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const directory = yield* fs.makeTempDirectoryScoped();

      const missingPath = yield* Config.string("API_TOKEN").pipe(
        Effect.provide(RuntimeConfig.layerHosted()),
        Effect.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({}))),
        Effect.flip,
      );
      const unreadableFile = yield* Config.string("API_TOKEN").pipe(
        Effect.provide(RuntimeConfig.layerHosted()),
        Effect.provide(
          ConfigProvider.layer(
            ConfigProvider.fromUnknown({
              [RuntimeConfig.PlatformRuntimeKey.configPath]: `${directory}/missing.json`,
            }),
          ),
        ),
        Effect.flip,
      );

      expect(missingPath).toMatchObject({ code: "CONFIG_PATH_MISSING" });
      expect(unreadableFile).toMatchObject({ code: "CONFIG_FILE_UNREADABLE" });
    }).pipe(Effect.provide(NodeServices.layer)),
  );

  it.effect("rejects malformed JSON", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const directory = yield* fs.makeTempDirectoryScoped();
      const configPath = `${directory}/config.json`;
      yield* fs.writeFileString(configPath, "{");

      const error = yield* Config.string("API_TOKEN").pipe(
        Effect.provide(RuntimeConfig.layerHosted()),
        Effect.provide(
          ConfigProvider.layer(
            ConfigProvider.fromUnknown({
              [RuntimeConfig.PlatformRuntimeKey.configPath]: configPath,
            }),
          ),
        ),
        Effect.flip,
      );

      expect(error).toMatchObject({ code: "CONFIG_JSON_INVALID" });
    }).pipe(Effect.provide(NodeServices.layer)),
  );

  it.effect("loads the JSON file and lets environment values override individual keys", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const directory = yield* fs.makeTempDirectoryScoped();
      const configPath = `${directory}/config.json`;
      yield* fs.writeFileString(
        configPath,
        JSON.stringify({ API_TOKEN: "file-token", API_PORT: 8080, API_ENABLED: true }),
      );

      const config = yield* Config.all({
        token: Config.redacted("API_TOKEN"),
        port: Config.number("API_PORT"),
        enabled: Config.boolean("API_ENABLED"),
      }).pipe(
        Effect.provide(RuntimeConfig.layerHosted()),
        Effect.provide(
          ConfigProvider.layer(
            ConfigProvider.fromUnknown({
              [RuntimeConfig.PlatformRuntimeKey.configPath]: configPath,
              API_TOKEN: "env-token",
            }),
          ),
        ),
      );

      expect(Redacted.value(config.token)).toBe("env-token");
      expect(config.port).toBe(8080);
      expect(config.enabled).toBe(true);
    }).pipe(Effect.provide(NodeServices.layer)),
  );

  it.effect("does not hide an invalid environment override with a valid file value", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const directory = yield* fs.makeTempDirectoryScoped();
      const configPath = `${directory}/config.json`;
      yield* fs.writeFileString(configPath, JSON.stringify({ API_PORT: 8080 }));

      const result = yield* Config.number("API_PORT").pipe(
        Effect.provide(RuntimeConfig.layerHosted()),
        Effect.provide(
          ConfigProvider.layer(
            ConfigProvider.fromUnknown({
              [RuntimeConfig.PlatformRuntimeKey.configPath]: configPath,
              API_PORT: "not-a-number",
            }),
          ),
        ),
        Effect.exit,
      );

      expect(Exit.isFailure(result)).toBe(true);
    }).pipe(Effect.provide(NodeServices.layer)),
  );
});
