import { Config } from "effect";

import { PlatformRuntimeDefault, PlatformRuntimeKey } from "./constants";

/** Shared HTTP port used by hosted and sandbox connector entrypoints. */
export const httpPort = Config.Port(PlatformRuntimeKey.httpPort).pipe(
  Config.withDefault(PlatformRuntimeDefault.httpPort),
);

/** Wings URL, including the protocol. */
export const wingsUri = Config.URL(PlatformRuntimeKey.wingsUri);

/** Wings catalog ID. */
export const catalog = Config.NonEmptyString(PlatformRuntimeKey.catalog);
