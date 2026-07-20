import { DateTime, Effect, Schema as EffectSchema } from "effect";

import { Generation } from "./resource";

/** Kubernetes condition status. */
export const Status = EffectSchema.Literals(["True", "False", "Unknown"]);
export type Status = typeof Status.Type;

/** Standard Kubernetes condition schema. */
export const Schema = EffectSchema.Struct({
  type: EffectSchema.String.check(EffectSchema.isNonEmpty()),
  status: Status,
  observedGeneration: EffectSchema.optionalKey(Generation),
  lastTransitionTime: EffectSchema.DateFromString.pipe(
    EffectSchema.annotateEncoded({ format: "date-time" }),
  ),
  reason: EffectSchema.String.check(EffectSchema.isNonEmpty()),
  message: EffectSchema.String,
});
export type Condition = typeof Schema.Type;

/** Conditions use their type as the Kubernetes merge key. */
export const List = EffectSchema.Array(Schema).annotate({
  "x-kubernetes-list-type": "map",
  "x-kubernetes-list-map-keys": ["type"],
});

/** Values used to create or replace a condition. */
export interface Update {
  readonly type: string;
  readonly status: Status;
  readonly observedGeneration?: number;
  readonly reason: string;
  readonly message: string;
}

/**
 * Inserts or replaces one condition by type while preserving list order.
 * Transition time changes only when status changes and is read from Effect's `Clock`.
 */
export const set = (
  conditions: ReadonlyArray<Condition>,
  update: Update,
): Effect.Effect<ReadonlyArray<Condition>> =>
  Effect.gen(function* () {
    const index = conditions.findIndex((condition) => condition.type === update.type);
    const current = index === -1 ? undefined : conditions[index];
    const lastTransitionTime =
      current !== undefined && current.status === update.status
        ? current.lastTransitionTime
        : yield* DateTime.nowAsDate;
    const next: Condition = { ...update, lastTransitionTime };

    return index === -1
      ? [...conditions, next]
      : conditions.map((condition, currentIndex) => (currentIndex === index ? next : condition));
  });
