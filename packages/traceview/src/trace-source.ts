import { Context, Effect } from "effect";

import type { Trace } from "./model";

import { TraceSourceError } from "./model";

/** Fetches a fully-assembled `Trace` by ID from a configured backend (Axiom or Jaeger). */
export interface TraceSourceService {
  readonly fetch: (traceId: string) => Effect.Effect<Trace, TraceSourceError>;
}

export class TraceSource extends Context.Service<TraceSource, TraceSourceService>()(
  "@useairfoil/traceview/TraceSource",
) {}
