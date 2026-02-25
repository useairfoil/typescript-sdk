import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import * as Path from "node:path";
import { Effect } from "effect";
import { ConnectorError } from "../core/errors";
import type { VcrCassette } from "./types";

export const cassettePath = (cassetteDir: string, cassetteName: string) =>
  Path.join(cassetteDir, `${cassetteName}.json`);

// check if cassette file exists on disk
export const isCassetteAvailable = (
  path: string,
): Effect.Effect<boolean, ConnectorError> =>
  Effect.tryPromise({
    try: () =>
      access(path)
        .then(() => true)
        .catch(() => false),
    catch: (error) =>
      new ConnectorError({ message: "Failed to check cassette", cause: error }),
  });

export const createEmptyCassette = (): VcrCassette => ({
  meta: {
    createdAt: new Date().toISOString(),
    version: "1",
  },
  entries: {},
});

// read cassette json from disk
export const loadCassette = (
  path: string,
): Effect.Effect<VcrCassette, ConnectorError> =>
  Effect.tryPromise({
    try: async () => {
      const content = await readFile(path, "utf8");
      return JSON.parse(content) as VcrCassette;
    },
    catch: (error) =>
      new ConnectorError({ message: "Failed to load cassette", cause: error }),
  });

// write cassette json to disk
export const saveCassette = (
  path: string,
  cassette: VcrCassette,
): Effect.Effect<void, ConnectorError> =>
  Effect.tryPromise({
    try: async () => {
      await mkdir(Path.dirname(path), { recursive: true });
      await writeFile(path, JSON.stringify(cassette, null, 2), "utf8");
    },
    catch: (error) =>
      new ConnectorError({ message: "Failed to save cassette", cause: error }),
  });

// load if present, else create and persist
export const loadOrInitCassette = (
  path: string,
): Effect.Effect<VcrCassette, ConnectorError> =>
  isCassetteAvailable(path).pipe(
    Effect.flatMap((available) =>
      available
        ? loadCassette(path)
        : Effect.succeed(createEmptyCassette()).pipe(
            Effect.tap((cassette) => saveCassette(path, cassette)),
          ),
    ),
  );
