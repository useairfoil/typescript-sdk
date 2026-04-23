import { Context, DateTime, Effect, Layer, Schema, FileSystem } from "effect";

import type { VcrCassette, VcrCassetteFile } from "./types";

/**
 * Storage contract for VCR cassettes.
 *
 */
export interface CassetteStoreService {
  readonly exists: (path: string) => Effect.Effect<boolean, CassetteStoreError>;
  readonly load: (path: string) => Effect.Effect<VcrCassetteFile, CassetteStoreError>;
  readonly save: (
    path: string,
    cassette: VcrCassetteFile,
  ) => Effect.Effect<void, CassetteStoreError>;
  readonly loadOrInit: (path: string) => Effect.Effect<VcrCassetteFile, CassetteStoreError>;
}

/**
 * Effect service tag for the cassette store.
 */
export class CassetteStore extends Context.Service<CassetteStore, CassetteStoreService>()(
  "@useairfoil/effect-http-client/CassetteStore",
) {}

/**
 * Creates a new empty cassette with a timestamp and format version.
 */
export const createEmptyCassette = (): Effect.Effect<VcrCassette> =>
  Effect.gen(function* () {
    const now = yield* DateTime.now;
    return {
      meta: {
        createdAt: DateTime.formatIso(now),
        version: "1",
      },
      entries: {},
    };
  });

export const createEmptyCassetteFile = (): Effect.Effect<VcrCassetteFile> =>
  Effect.map(createEmptyCassette(), (cassette) => ({
    exports: { default: cassette },
  }));

/**
 * Structured error for cassette persistence operations.
 *
 * `operation` indicates which store function failed.
 * `path` is the file or directory path that was targeted.
 */
export class CassetteStoreError extends Schema.TaggedErrorClass<CassetteStoreError>()(
  "CassetteStoreError",
  {
    operation: Schema.String,
    path: Schema.String,
    message: Schema.optional(Schema.String),
    cause: Schema.optional(Schema.Unknown),
  },
) {}

const toStoreError = (
  operation: "exists" | "load" | "save" | "loadOrInit",
  path: string,
  cause?: unknown,
  message?: string,
) =>
  new CassetteStoreError({
    operation,
    path,
    cause,
    message,
  });

/**
 * Parses cassette JSON and maps invalid JSON to a store error.
 */
const parseCassette = (content: string, path: string) =>
  Effect.try({
    try: () => JSON.parse(content) as VcrCassetteFile,
    catch: (error) => toStoreError("load", path, error, "Invalid JSON"),
  }).pipe(
    Effect.flatMap((parsed) => {
      if (!parsed || typeof parsed !== "object" || !("exports" in parsed)) {
        return Effect.fail(toStoreError("load", path, undefined, "Invalid cassette file format"));
      }
      return Effect.succeed(parsed);
    }),
  );

/**
 * FileSystem-backed cassette store.
 *
 * Requires a platform FileSystem layer (Node/Bun) to be provided by the user.
 */
export const CassetteStoreLive = Layer.effect(CassetteStore)(
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;

    const load = (path: string) =>
      fs.readFileString(path).pipe(
        Effect.mapError((error) => toStoreError("load", path, error)),
        Effect.flatMap((content) => parseCassette(content, path)),
      );

    const save = (path: string, cassette: VcrCassetteFile) => {
      const dir = path.split(/[/\\]/).slice(0, -1).join("/");
      const ensureDir =
        dir === ""
          ? Effect.void
          : fs
              .makeDirectory(dir, { recursive: true })
              .pipe(Effect.mapError((error) => toStoreError("save", dir, error)));
      return ensureDir.pipe(
        Effect.andThen(
          fs
            .writeFileString(path, JSON.stringify(cassette, null, 2))
            .pipe(Effect.mapError((error) => toStoreError("save", path, error))),
        ),
      );
    };

    const loadOrInit = (path: string) =>
      fs.exists(path).pipe(
        Effect.mapError((error) => toStoreError("loadOrInit", path, error)),
        Effect.flatMap((exists) =>
          exists
            ? load(path)
            : createEmptyCassetteFile().pipe(Effect.tap((cassette) => save(path, cassette))),
        ),
      );

    return {
      exists: (path: string) =>
        fs.exists(path).pipe(Effect.mapError((error) => toStoreError("exists", path, error))),
      load,
      save,
      loadOrInit,
    } satisfies CassetteStoreService;
  }),
);
