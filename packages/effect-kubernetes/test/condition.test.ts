import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { TestClock } from "effect/testing";

import { Condition } from "../src/operator";

describe("Condition", () => {
  it.effect("preserves transition time until status changes", () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(1_000);
      const inserted = yield* Condition.set([], {
        type: "Ready",
        status: "False",
        observedGeneration: 1,
        reason: "Progressing",
        message: "waiting",
      });

      yield* TestClock.setTime(2_000);
      const sameStatus = yield* Condition.set(inserted, {
        type: "Ready",
        status: "False",
        observedGeneration: 2,
        reason: "StillProgressing",
        message: "still waiting",
      });

      expect(sameStatus[0]?.observedGeneration).toBe(2);
      expect(sameStatus[0]?.reason).toBe("StillProgressing");
      expect(sameStatus[0]?.lastTransitionTime).toEqual(new Date(1_000));

      yield* TestClock.setTime(3_000);
      const transitioned = yield* Condition.set(sameStatus, {
        type: "Ready",
        status: "True",
        observedGeneration: 2,
        reason: "Available",
        message: "ready",
      });

      expect(transitioned).toHaveLength(1);
      expect(transitioned[0]?.status).toBe("True");
      expect(transitioned[0]?.lastTransitionTime).toEqual(new Date(3_000));
    }),
  );
});
