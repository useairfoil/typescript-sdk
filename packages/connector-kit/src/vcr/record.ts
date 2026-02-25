import { Effect } from "effect";
import type { ConnectorError } from "../core/errors";
import { loadOrInitCassette, saveCassette } from "./helper";
import { buildRequestKey, redactRequest, redactResponse } from "./sanitize";
import type { VcrCassette, VcrRequest, VcrResponse } from "./types";

type RecordOptions = {
  readonly cassettePath: string;
  readonly realFetch: (
    request: VcrRequest,
  ) => Effect.Effect<VcrResponse, ConnectorError>;
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
};

// record mode: read cassette, then write updated copy
export const makeRecordFetch =
  ({ cassettePath, realFetch, redact, matchIgnore }: RecordOptions) =>
  (request: VcrRequest): Effect.Effect<VcrResponse, ConnectorError> =>
    Effect.gen(function* () {
      const response = yield* realFetch(request);
      const sanitizedRequest = redact
        ? redactRequest(request, {
            redactHeaders: redact.requestHeaders,
            redactBodyKeys: redact.requestBodyKeys,
          })
        : request;
      const sanitizedResponse = redact
        ? redactResponse(response, {
            redactHeaders: redact.responseHeaders,
            redactBodyKeys: redact.responseBodyKeys,
          })
        : response;
      const cassette = yield* loadOrInitCassette(cassettePath);
      const key = buildRequestKey(sanitizedRequest, {
        ignoreHeaders: matchIgnore?.requestHeaders,
        ignoreBodyKeys: matchIgnore?.requestBodyKeys,
      });
      const nextEntries = {
        ...cassette.entries,
        [key]: {
          request: sanitizedRequest,
          response: sanitizedResponse,
        },
      };

      const next: VcrCassette = {
        ...cassette,
        entries: nextEntries,
      };
      yield* saveCassette(cassettePath, next);
      return response;
    });
