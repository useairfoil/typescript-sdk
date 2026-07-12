import { Cause, Duration } from "effect";

export type Result =
  | { readonly _tag: "Complete" }
  | { readonly _tag: "RequeueAfter"; readonly delay: Duration.Duration };

export const complete: Result = { _tag: "Complete" };

export const requeueAfter = (delay: Duration.Input): Result => {
  const duration = Duration.fromInputUnsafe(delay);
  if (Duration.isNegative(duration) || !Duration.isFinite(duration)) {
    throw new Cause.IllegalArgumentError("requeue delay must be a non-negative finite duration");
  }
  return { _tag: "RequeueAfter", delay: duration };
};
