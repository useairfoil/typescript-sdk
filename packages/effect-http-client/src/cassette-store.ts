import { FileSystem } from "@effect/platform";
import { Context, DateTime, Effect, Layer, Schema } from "effect";
import type { VcrCassette } from "./types";

/**
 * Storage contract for VCR cassettes.
 *
 */
export interface CassetteStoreService {
  readonly exists: (path: string) => Effect.Effect<boolean, CassetteStoreError>;
  readonly load: (
    path: string,
  ) => Effect.Effect<VcrCassette, CassetteStoreError>;
  readonly save: (
    path: string,
    cassette: VcrCassette,
  ) => Effect.Effect<void, CassetteStoreError>;
  readonly loadOrInit: (
    path: string,
  ) => Effect.Effect<VcrCassette, CassetteStoreError>;
}

/**
 * Effect service tag for the cassette store.
 */
export class CassetteStore extends Context.Tag(
  "@useairfoil/effect-http-client/CassetteStore",
)<CassetteStore, CassetteStoreService>() {}

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

/**
 * Structured error for cassette persistence operations.
 *
 * `operation` indicates which store function failed.
 * `path` is the file or directory path that was targeted.
 */
export class CassetteStoreError extends Schema.TaggedError<CassetteStoreError>()(
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
    try: () => JSON.parse(content) as VcrCassette,
    catch: (error) => toStoreError("load", path, error, "Invalid JSON"),
  });

/**
 * FileSystem-backed cassette store.
 *
 * Requires a platform FileSystem layer (Node/Bun) to be provided by the user.
 */
export const CassetteStoreLive = Layer.effect(
  CassetteStore,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;

    const load = (path: string) =>
      fs.readFileString(path).pipe(
        Effect.mapError((error) => toStoreError("load", path, error)),
        Effect.flatMap((content) => parseCassette(content, path)),
      );

    const save = (path: string, cassette: VcrCassette) => {
      const dir = path.split(/[/\\]/).slice(0, -1).join("/");
      const ensureDir =
        dir === ""
          ? Effect.void
          : fs
              .makeDirectory(dir, { recursive: true })
              .pipe(
                Effect.mapError((error) => toStoreError("save", dir, error)),
              );
      return ensureDir.pipe(
        Effect.zipRight(
          fs
            .writeFileString(path, JSON.stringify(cassette, null, 2))
            .pipe(
              Effect.mapError((error) => toStoreError("save", path, error)),
            ),
        ),
      );
    };

    const loadOrInit = (path: string) =>
      fs.exists(path).pipe(
        Effect.mapError((error) => toStoreError("loadOrInit", path, error)),
        Effect.flatMap((exists) =>
          exists
            ? load(path)
            : createEmptyCassette().pipe(
                Effect.tap((cassette) => save(path, cassette)),
              ),
        ),
      );

    return {
      exists: (path: string) =>
        fs
          .exists(path)
          .pipe(
            Effect.mapError((error) => toStoreError("exists", path, error)),
          ),
      load,
      save,
      loadOrInit,
    } satisfies CassetteStoreService;
  }),
);
