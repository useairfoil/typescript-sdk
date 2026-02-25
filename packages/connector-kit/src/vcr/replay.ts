import { Effect } from "effect";
import { ConnectorError } from "../core/errors";
import { loadCassette } from "./helper";
import { buildRequestKey } from "./sanitize";
import type { VcrEntry, VcrRequest, VcrResponse } from "./types";

type ReplayOptions = {
  readonly cassettePath: string;
  readonly match?: (request: VcrRequest, entry: VcrEntry) => boolean;
  readonly matchIgnore?: {
    readonly requestHeaders?: ReadonlyArray<string>;
    readonly requestBodyKeys?: ReadonlyArray<string>;
  };
};

// replay mode: read cassette, then return matching entry
export const makeReplayFetch =
  ({ cassettePath, match, matchIgnore }: ReplayOptions) =>
  (request: VcrRequest): Effect.Effect<VcrResponse, ConnectorError> =>
    Effect.gen(function* () {
      const cassette = yield* loadCassette(cassettePath);
      const entry = match
        ? Object.values(cassette.entries).find((item) => match(request, item))
        : cassette.entries[
            buildRequestKey(request, {
              ignoreHeaders: matchIgnore?.requestHeaders,
              ignoreBodyKeys: matchIgnore?.requestBodyKeys,
            })
          ];

      if (!entry) {
        return yield* Effect.fail(
          new ConnectorError({
            message: `VCR replay missing entry for ${request.method} ${request.url}`,
          }),
        );
      }
      return entry.response;
    });
