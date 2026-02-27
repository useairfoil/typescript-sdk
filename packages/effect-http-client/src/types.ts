/**
 * VCR operating mode.
 * - record: always call the live client and persist.
 * - replay: serve only from cassette, fail if missing.
 * - auto: replay if cassette exists, otherwise record (fail in CI).
 */
export type VcrMode = "record" | "replay" | "auto";

/**
 * Serialized request shape stored in a cassette.
 */
export type VcrRequest = {
  readonly method: string;
  readonly url: string;
  readonly headers?: Record<string, string>;
  readonly body?: string;
};

/**
 * Serialized response shape stored in a cassette.
 */
export type VcrResponse = {
  readonly status: number;
  readonly body: string;
  readonly headers?: Record<string, string>;
};

/**
 * A single request/response pair keyed in the cassette.
 */
export type VcrEntry = {
  readonly request: VcrRequest;
  readonly response: VcrResponse;
};

/**
 * Cassette file format.
 */
export type VcrCassette = {
  readonly meta: {
    readonly createdAt: string;
    readonly version: string;
  };
  readonly entries: Record<string, VcrEntry>;
};

/**
 * VCR configuration.
 */
export type VcrConfig = {
  readonly cassetteDir: string;
  readonly cassetteName: string;
  readonly mode: VcrMode;
  /**
   * Remove sensitive data before writing to disk.
   */
  readonly redact?: {
    readonly requestHeaders?: ReadonlyArray<string>;
    readonly responseHeaders?: ReadonlyArray<string>;
    readonly requestBodyKeys?: ReadonlyArray<string>;
    readonly responseBodyKeys?: ReadonlyArray<string>;
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
