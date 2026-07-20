import { Cause, Duration } from "effect";

/** Scheduling decision returned by a reconciler. */
export type Result =
  | { readonly _tag: "Complete" }
  | { readonly _tag: "RequeueAfter"; readonly delay: Duration.Duration };

/** Marks the current reconciliation as complete until another event or resync. */
export const complete: Result = { _tag: "Complete" };

/** Schedules the key again after a non-negative finite delay. */
export const requeueAfter = (delay: Duration.Input): Result => {
  const duration = Duration.fromInputUnsafe(delay);
  if (Duration.isNegative(duration) || !Duration.isFinite(duration)) {
    throw new Cause.IllegalArgumentError("requeue delay must be a non-negative finite duration");
  }
  return { _tag: "RequeueAfter", delay: duration };
};
