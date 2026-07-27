import { Schema } from "effect";

/**
 * VCR operating mode.
 * - record: always call the live client and persist.
 * - replay: serve only from cassette, fail if missing.
 * - auto: replay if cassette exists, otherwise record (fail in CI).
 */
export type VcrMode = "record" | "replay" | "auto";

/**
 * Safe scalar value written in place of a sensitive body field.
 */
export type VcrRedactedValue = string | number | boolean | null;

/**
 * Serialized request shape stored in a cassette.
 */
export const VcrRequestSchema = Schema.Struct({
  method: Schema.String,
  url: Schema.String,
  headers: Schema.optional(Schema.Record(Schema.String, Schema.String)),
  body: Schema.optional(Schema.String),
});
export type VcrRequest = Schema.Schema.Type<typeof VcrRequestSchema>;

/**
 * Serialized response shape stored in a cassette.
 */
export const VcrResponseSchema = Schema.Struct({
  status: Schema.Number,
  body: Schema.String,
  headers: Schema.optional(Schema.Record(Schema.String, Schema.String)),
});
export type VcrResponse = Schema.Schema.Type<typeof VcrResponseSchema>;

/**
 * A single request/response pair keyed in the cassette.
 */
export const VcrEntrySchema = Schema.Struct({
  request: VcrRequestSchema,
  response: VcrResponseSchema,
});
export type VcrEntry = Schema.Schema.Type<typeof VcrEntrySchema>;

/**
 * Cassette file format.
 */
export const CassetteSchema = Schema.Struct({
  meta: Schema.Struct({
    createdAt: Schema.String,
    version: Schema.String,
  }),
  entries: Schema.Record(Schema.String, VcrEntrySchema),
});
export type Cassette = Schema.Schema.Type<typeof CassetteSchema>;

/**
 * Cassette file format with multiple exports.
 */
export const CassetteFileSchema = Schema.Struct({
  exports: Schema.Record(Schema.String, CassetteSchema),
});
export type CassetteFile = Schema.Schema.Type<typeof CassetteFileSchema>;

/**
 * VCR configuration.
 */
export type VcrConfig = {
  readonly vcrName?: string;
  /**
   * Cassette file name or basename.
   *
   * `users` resolves to `users.cassette`.
   * `users.cassette` is preserved as-is.
   */
  readonly cassetteName?: string;
  readonly mode?: VcrMode;
  /**
   * Remove or replace sensitive data before writing to disk.
   */
  readonly redact?: {
    readonly requestHeaders?: ReadonlyArray<string>;
    readonly responseHeaders?: ReadonlyArray<string>;
    readonly requestBodyKeys?: ReadonlyArray<string>;
    readonly responseBodyKeys?: ReadonlyArray<string>;
    readonly requestBodyReplacements?: Readonly<Record<string, VcrRedactedValue>>;
    readonly responseBodyReplacements?: Readonly<Record<string, VcrRedactedValue>>;
  };
  /**
   * Ignore fields when computing the request key for replay matching.
   */
  readonly matchIgnore?: {
    readonly requestHeaders?: ReadonlyArray<string>;
    readonly requestBodyKeys?: ReadonlyArray<string>;
  };
  /**
   * Custom matcher to override key-based lookup.
   */
  readonly match?: (request: VcrRequest, entry: VcrEntry) => boolean;
};
