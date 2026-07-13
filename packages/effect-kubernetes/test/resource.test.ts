import { describe, expect, it } from "@effect/vitest";
import * as k8s from "@kubernetes/client-node";
import { Effect, Option, Schema } from "effect";
import { readFileSync } from "node:fs";

import { MemcachedCrd } from "../examples/memcached";
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

  it.effect("generates the checked-in Memcached CustomResourceDefinition", () =>
    Effect.gen(function* () {
      const generated = yield* MemcachedCrd;
      const version = generated.spec.versions[0];

      expect(generated.metadata?.name).toBe("memcacheds.cache.example.com");
      expect(generated.spec.scope).toBe("Namespaced");
      expect(generated.spec.names).toEqual({
        kind: "Memcached",
        plural: "memcacheds",
        singular: "memcached",
        shortNames: ["mc"],
      });
      expect(version?.name).toBe("v1alpha1");
      expect(version?.served).toBe(true);
      expect(version?.storage).toBe(true);
      expect(version?.subresources).toEqual({ status: {} });
      expect(version?.additionalPrinterColumns).toHaveLength(3);
      expect(version?.schema?.openAPIV3Schema?.properties).toHaveProperty("spec");
      expect(version?.schema?.openAPIV3Schema?.properties).not.toHaveProperty("metadata");

      const checkedIn = k8s.loadYaml<k8s.V1CustomResourceDefinition>(
        readFileSync(new URL("../examples/memcached-crd.yaml", import.meta.url), "utf8"),
      );
      const serialized = k8s.loadYaml<k8s.V1CustomResourceDefinition>(k8s.dumpYaml(generated));
      expect(serialized).toEqual(checkedIn);
    }),
  );

  it.effect("converts exclusive Effect bounds to Kubernetes OpenAPI bounds", () => {
    const BoundedResource = Resource.custom({
      group: "example.com",
      version: "v1",
      kind: "Bounded",
      plural: "boundeds",
      namespaced: true,
      schema: Schema.Struct({
        spec: Schema.Struct({
          count: Schema.Number.check(
            Schema.isInt32(),
            Schema.isGreaterThan(0),
            Schema.isLessThan(10),
          ),
        }),
      }),
    });

    return Effect.gen(function* () {
      const crd = yield* Resource.makeCustomResourceDefinition(BoundedResource);
      const count =
        crd.spec.versions[0]?.schema?.openAPIV3Schema?.properties?.spec.properties?.count;

      expect(count?.allOf).toEqual([
        { minimum: -2_147_483_648, maximum: 2_147_483_647 },
        { minimum: 0, exclusiveMinimum: true },
        { maximum: 10, exclusiveMaximum: true },
      ]);
    });
  });

  it.effect("rejects Effect schemas that are not Kubernetes structural schemas", () => {
    const InvalidResource = Resource.custom({
      group: "example.com",
      version: "v1",
      kind: "Invalid",
      plural: "invalids",
      namespaced: true,
      schema: Schema.Struct({
        spec: Schema.Struct({ values: Schema.Array(Schema.String).check(Schema.isUnique()) }),
      }),
    });

    return Effect.gen(function* () {
      const error = yield* Resource.makeCustomResourceDefinition(InvalidResource).pipe(Effect.flip);

      expect(error).toBeInstanceOf(Resource.CrdGenerationError);
      expect(error.message).toContain("uniqueItems cannot be true");
    });
  });
});
