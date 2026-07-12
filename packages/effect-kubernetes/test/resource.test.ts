import { describe, expect, it } from "@effect/vitest";
import { Effect, Option, Schema } from "effect";

import { Resource } from "../src/operator";
import { makeFake } from "../src/testing";

const TestResource = Resource.custom({
  group: "example.com",
  version: "v1",
  kind: "Test",
  plural: "tests",
  namespaced: true,
  schema: Schema.Struct({
    metadata: Resource.Metadata,
    spec: Schema.Struct({ value: Schema.String }),
  }),
});

describe("Resource", () => {
  it.effect("gets and decodes custom resources", () =>
    Effect.gen(function* () {
      const fake = yield* makeFake();
      yield* fake.put(
        { group: "example.com", version: "v1", plural: "tests", namespaced: true },
        {
          metadata: { namespace: "default", name: "one" },
          spec: { value: "ok" },
        },
      );

      const object = yield* Resource.get(TestResource, { namespace: "default", name: "one" }).pipe(
        Effect.provide(fake.layer),
      );

      expect(Option.getOrThrow(object).spec.value).toBe("ok");
    }),
  );

  it.effect("reports schema decode failures with resource context", () =>
    Effect.gen(function* () {
      const fake = yield* makeFake();
      yield* fake.put(
        { group: "example.com", version: "v1", plural: "tests", namespaced: true },
        {
          metadata: { namespace: "default", name: "invalid" },
          spec: { value: 42 },
        },
      );

      const error = yield* Resource.get(TestResource, {
        namespace: "default",
        name: "invalid",
      }).pipe(Effect.provide(fake.layer), Effect.flip);

      expect(error).toBeInstanceOf(Resource.ResourceDecodeError);
      if (!(error instanceof Resource.ResourceDecodeError)) return;
      expect(error.resource).toBe("example.com/v1/tests");
      expect(error.key).toEqual({ namespace: "default", name: "invalid" });
    }),
  );

  it.effect("lists and decodes every custom resource", () =>
    Effect.gen(function* () {
      const fake = yield* makeFake();
      yield* fake.put(
        { group: "example.com", version: "v1", plural: "tests", namespaced: true },
        { metadata: { namespace: "default", name: "one" }, spec: { value: "first" } },
      );
      yield* fake.put(
        { group: "example.com", version: "v1", plural: "tests", namespaced: true },
        { metadata: { namespace: "default", name: "two" }, spec: { value: "second" } },
      );

      const objects = yield* Resource.list(TestResource, "default").pipe(
        Effect.provide(fake.layer),
      );

      expect(objects.map((object) => object.spec.value)).toEqual(["first", "second"]);
    }),
  );
});
