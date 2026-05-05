import { Effect, Layer, FileSystem, Path } from "effect";

import type { CassetteFile } from "./types";

import * as CassetteStore from "./cassette-store";
import { getVitestState } from "./vitest-state";

export type FileSystemCassetteStoreConfig = {
  readonly cassetteDir?: string;
};

/**
 * FileSystem-backed cassette store.
 *
 * Requires a platform FileSystem layer (Node/Bun) to be provided by the user.
 */
export const layer = (config: FileSystemCassetteStoreConfig = {}) =>
  Layer.effect(CassetteStore.CassetteStore)(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;

      let rootDir: string;
      if (config.cassetteDir) {
        rootDir = config.cassetteDir;
      } else {
        const { testPath } = getVitestState();
        if (!testPath) {
          return yield* Effect.fail(
            CassetteStore.toStoreError(
              "resolveRoot",
              "__cassettes__",
              undefined,
              "VCR cassette directory could not be inferred. Provide cassetteDir when not running in Vitest.",
            ),
          );
        }
        const testFolder = path.dirname(testPath);
        rootDir = path.join(testFolder, "__cassettes__");
      }

      const fullPath = (name: string) => path.join(rootDir, name);

      const load = (name: string) =>
        fs.readFileString(fullPath(name)).pipe(
          Effect.mapError((error) => CassetteStore.toStoreError("load", name, error)),
          Effect.flatMap((content) => CassetteStore.parseCassette(content, name)),
        );

      const save = (name: string, cassette: CassetteFile) => {
        const filePath = fullPath(name);
        const dir = path.dirname(filePath);
        const ensureDir =
          dir === ""
            ? Effect.void
            : fs
                .makeDirectory(dir, { recursive: true })
                .pipe(Effect.mapError((error) => CassetteStore.toStoreError("save", dir, error)));
        return ensureDir.pipe(
          Effect.andThen(
            fs
              .writeFileString(filePath, JSON.stringify(cassette, null, 2))
              .pipe(Effect.mapError((error) => CassetteStore.toStoreError("save", name, error))),
          ),
        );
      };

      const loadOrInit = (name: string) =>
        fs.exists(fullPath(name)).pipe(
          Effect.mapError((error) => CassetteStore.toStoreError("loadOrInit", name, error)),
          Effect.flatMap((exists) =>
            exists
              ? load(name)
              : CassetteStore.createEmptyCassetteFile().pipe(
                  Effect.tap((cassette) => save(name, cassette)),
                ),
          ),
        );

      return CassetteStore.make({
        exists: (name: string) =>
          fs
            .exists(fullPath(name))
            .pipe(Effect.mapError((error) => CassetteStore.toStoreError("exists", name, error))),
        load,
        save,
        loadOrInit,
      });
    }),
  );
