import { Effect } from "effect";
import { ConnectorError } from "../core/errors";
import { cassettePath, isCassetteAvailable } from "./helper";
import { makeRecordFetch } from "./record";
import { makeReplayFetch } from "./replay";
import type { VcrConfig, VcrRequest, VcrResponse } from "./types";

// auto mode: record if missing, replay otherwise
const resolveMode = (
  config: VcrConfig,
  path: string,
): Effect.Effect<"record" | "replay", ConnectorError> =>
  config.mode === "auto"
    ? isCassetteAvailable(path).pipe(
        Effect.flatMap((available) => {
          if (available) {
            return Effect.succeed("replay" as const);
          }

          if (process.env.CI === "true") {
            return Effect.fail(
              new ConnectorError({
                message: "VCR cassette missing in CI for auto mode",
              }),
            );
          }

          return Effect.succeed("record" as const);
        }),
      )
    : Effect.succeed(config.mode);

// returns a fetch wrapper based on vcr mode
export const makeVcrFetch = (
  config: VcrConfig,
  realFetch: (
    request: VcrRequest,
  ) => Effect.Effect<VcrResponse, ConnectorError>,
): Effect.Effect<
  (request: VcrRequest) => Effect.Effect<VcrResponse, ConnectorError>,
  ConnectorError
> =>
  Effect.gen(function* () {
    const path = cassettePath(config.cassetteDir, config.cassetteName);
    const mode = yield* resolveMode(config, path);
    const match = config.match;

    if (mode === "record") {
      return makeRecordFetch({
        cassettePath: path,
        realFetch,
        redact: config.redact,
        matchIgnore: config.matchIgnore,
      });
    }

    return makeReplayFetch({
      cassettePath: path,
      match,
      matchIgnore: config.matchIgnore,
    });
  });

export { cassettePath, isCassetteAvailable } from "./helper";
export type { VcrConfig, VcrEntry, VcrRequest, VcrResponse } from "./types";
