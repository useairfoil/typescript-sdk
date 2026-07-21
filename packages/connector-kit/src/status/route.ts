import { Cause, Effect } from "effect";
import { HttpRouter, HttpServerResponse } from "effect/unstable/http";

import type { ConnectorDefinition } from "../core/types";
import type { ResourceStatus } from "./types";

import { StateStore } from "../state-store";
import { deriveSyncState, normalizeCursor } from "../state-store/state";

export const statusRoute = (
  connector: ConnectorDefinition,
  path: HttpRouter.PathInput = "/status",
) =>
  HttpRouter.add(
    "GET",
    path,
    Effect.gen(function* () {
      const store = yield* StateStore;

      const resources = yield* Effect.forEach(
        connector.resources,
        (resource) =>
          store.getResourceState(resource.name).pipe(
            Effect.map(
              (state): ResourceStatus => ({
                name: resource.name,
                state: deriveSyncState(resource, state),
                ...(state?.backfill
                  ? {
                      backfill: {
                        completed: state.backfill.completed,
                        cutoff: normalizeCursor(state.backfill.cutoff),
                        ...(state.backfill.pageCursor !== undefined
                          ? { pageCursor: normalizeCursor(state.backfill.pageCursor) }
                          : {}),
                      },
                    }
                  : {}),
                ...(state?.changes
                  ? { changes: { cursor: normalizeCursor(state.changes.cursor) } }
                  : {}),
                ...(state?.lastError ? { lastError: state.lastError } : {}),
              }),
            ),
          ),
        { concurrency: "unbounded" },
      );

      return HttpServerResponse.jsonUnsafe({ connector: connector.name, resources });
    }).pipe(
      Effect.catchCause((cause) =>
        Effect.logWarning(`Status route failed: ${Cause.pretty(cause)}`).pipe(
          Effect.andThen(
            Effect.succeed(
              HttpServerResponse.jsonUnsafe(
                { ok: false, error: "Failed to compute status" },
                { status: 500 },
              ),
            ),
          ),
        ),
      ),
    ),
  );
