export type VcrMode = "record" | "replay" | "auto";

export type VcrRequest = {
  readonly method: string;
  readonly url: string;
  readonly headers?: Record<string, string>;
  readonly body?: string;
};

export type VcrResponse = {
  readonly status: number;
  readonly body: string;
  readonly headers?: Record<string, string>;
};

export type VcrEntry = {
  readonly request: VcrRequest;
  readonly response: VcrResponse;
};

export type VcrCassette = {
  readonly meta: {
    readonly createdAt: string;
    readonly version: string;
  };
  readonly entries: Record<string, VcrEntry>;
};

export type VcrConfig = {
  readonly cassetteDir: string;
  readonly cassetteName: string;
  readonly mode: VcrMode;
  readonly redact?: {
    readonly requestHeaders?: ReadonlyArray<string>;
    readonly responseHeaders?: ReadonlyArray<string>;
    readonly requestBodyKeys?: ReadonlyArray<string>;
    readonly responseBodyKeys?: ReadonlyArray<string>;
  };
  readonly matchIgnore?: {
    readonly requestHeaders?: ReadonlyArray<string>;
    readonly requestBodyKeys?: ReadonlyArray<string>;
  };
  readonly match?: (request: VcrRequest, entry: VcrEntry) => boolean;
};
