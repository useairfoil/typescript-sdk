import { Context, DateTime, Effect, Schema } from "effect";

import type { Cassette, CassetteFile } from "./types";

/**
 * Storage contract for VCR cassettes.
 *
 */
export interface CassetteStore {
  /** Returns true if a cassette with the given name exists. */
  readonly exists: (name: string) => Effect.Effect<boolean, CassetteStoreError>;

  /** Loads a cassette by name, returning a `CassetteFile` if found. */
  readonly load: (name: string) => Effect.Effect<CassetteFile, CassetteStoreError>;

  /** Saves a cassette by name, overwriting any existing cassette with the same name. */
  readonly save: (name: string, content: CassetteFile) => Effect.Effect<void, CassetteStoreError>;

  /** Loads a cassette by name, initializing a new empty cassette if not found. */
  readonly loadOrInit: (name: string) => Effect.Effect<CassetteFile, CassetteStoreError>;
}

/**
 * Effect service tag for the cassette store.
 */
export const CassetteStore: Context.Service<CassetteStore, CassetteStore> = Context.Service(
  "@useairfoil/effect-vcr/CassetteStore",
);

/**
 * Creates a new empty cassette with a timestamp and format version.
 */
export const createEmptyCassette = (): Effect.Effect<Cassette> =>
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

export const createEmptyCassetteFile = (): Effect.Effect<CassetteFile> =>
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

export const toStoreError = (
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
export const parseCassette = (content: string, path: string) =>
  Effect.try({
    try: () => JSON.parse(content) as CassetteFile,
    catch: (error) => toStoreError("load", path, error, "Invalid JSON"),
  }).pipe(
    Effect.flatMap((parsed) => {
      if (!parsed || typeof parsed !== "object" || !("exports" in parsed)) {
        return Effect.fail(toStoreError("load", path, undefined, "Invalid cassette file format"));
      }
      return Effect.succeed(parsed);
    }),
  );

/** Creates a `CassetteStore` implementation that uses the given `impl` object. */
export const make = (impl: CassetteStore): CassetteStore =>
  CassetteStore.of({
    ...impl,
  });
