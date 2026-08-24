import type { WingsClientOptions } from "@useairfoil/wings/wings-client";

import { Config } from "effect";

import { PlatformRuntimeDefault, PlatformRuntimeKey } from "./constants";

/** Shared HTTP port used by hosted and sandbox connector entrypoints. */
export const httpPort = Config.port(PlatformRuntimeKey.httpPort).pipe(
  Config.withDefault(PlatformRuntimeDefault.httpPort),
);

/** Shared Wings client configuration supplied by the hosting platform. */
export const wingsClient = {
  host: Config.nonEmptyString(PlatformRuntimeKey.wingsHost),
  namespace: Config.nonEmptyString(PlatformRuntimeKey.wingsNamespace),
} satisfies Config.Wrap<WingsClientOptions>;
