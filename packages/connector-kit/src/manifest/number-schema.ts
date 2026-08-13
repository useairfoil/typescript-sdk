import { Schema } from "effect";

export type NumberConstraints = {
  readonly integer?: boolean;
  readonly minimum?: number;
};

export const makeNumberSchema = (constraints: NumberConstraints) => {
  if (constraints.integer) {
    return constraints.minimum === undefined
      ? Schema.Int
      : Schema.Int.check(Schema.isGreaterThanOrEqualTo(constraints.minimum));
  }
  return constraints.minimum === undefined
    ? Schema.Finite
    : Schema.Finite.check(Schema.isGreaterThanOrEqualTo(constraints.minimum));
};
