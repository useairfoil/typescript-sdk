import { describe, expect, it } from "@effect/vitest";
import * as k8s from "@kubernetes/client-node";
import { Deferred, Effect, Fiber, Option, Stream } from "effect";

import { Kubernetes, KubernetesError } from "../src";
import { make as makeWatch } from "../src/client/watch";
import { makeFake } from "../src/testing";

describe("Kubernetes", () => {
  it.effect("maps 404 from single-object reads to Option.none", () =>
    Effect.gen(function* () {
      const kubeConfig = makeKubeConfig({
        core: {
          readNamespacedSecret: () =>
            Promise.reject(new k8s.ApiException(404, "Not Found", {}, {})),
        },
      });

      const missing = yield* Kubernetes.readNamespacedSecret({
        namespace: "default",
        name: "missing",
      }).pipe(Effect.provide(Kubernetes.layer(kubeConfig)));

      expect(Option.isNone(missing)).toBe(true);
    }),
  );

  it.effect("keeps non-404 Kubernetes failures in the error channel", () =>
    Effect.gen(function* () {
      const kubeConfig = makeKubeConfig({
        core: {
          readNamespacedSecret: () =>
            Promise.reject(new k8s.ApiException(403, "Forbidden", {}, {})),
        },
      });

      const error = yield* Kubernetes.readNamespacedSecret({
        namespace: "default",
        name: "forbidden",
      }).pipe(Effect.provide(Kubernetes.layer(kubeConfig)), Effect.flip);

      expect(error).toBeInstanceOf(KubernetesError.KubernetesError);
      expect(error.code).toBe(403);
    }),
  );

  it.effect("stops the informer when the watch stream is interrupted", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const started = yield* Deferred.make<void>();
        const stopped = yield* Deferred.make<void>();
        const makeInformer: typeof k8s.makeInformer = () => ({
          on: () => undefined,
          off: () => undefined,
          start: () => {
            Deferred.doneUnsafe(started, Effect.void);
            return Promise.resolve();
          },
          stop: () => {
            Deferred.doneUnsafe(stopped, Effect.void);
            return Promise.resolve();
          },
          get: () => undefined,
          list: () => [],
          latestResourceVersion: () => "",
        });
        const watch = makeWatch(
          new k8s.KubeConfig(),
          makePartialGroup<k8s.CoreV1Api>({}),
          makePartialGroup<k8s.AppsV1Api>({}),
          makePartialGroup<k8s.CustomObjectsApi>({}),
          { makeInformer },
        );

        const fiber = yield* watch
          .watchCustomObjects({
            group: "example.com",
            version: "v1",
            plural: "tests",
            namespaced: true,
          })
          .pipe(Stream.runDrain, Effect.forkScoped);
        yield* Deferred.await(started);
        yield* Fiber.interrupt(fiber);

        yield* Deferred.await(stopped);
      }),
    ),
  );

  it.effect("does not defect when informer shutdown rejects", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const started = yield* Deferred.make<void>();
        const makeInformer: typeof k8s.makeInformer = () => ({
          on: () => undefined,
          off: () => undefined,
          start: () => {
            Deferred.doneUnsafe(started, Effect.void);
            return Promise.resolve();
          },
          stop: () => Promise.reject(new Error("stop failed")),
          get: () => undefined,
          list: () => [],
          latestResourceVersion: () => "",
        });
        const watch = makeWatch(
          new k8s.KubeConfig(),
          makePartialGroup<k8s.CoreV1Api>({}),
          makePartialGroup<k8s.AppsV1Api>({}),
          makePartialGroup<k8s.CustomObjectsApi>({}),
          { makeInformer },
        );

        const fiber = yield* watch
          .watchCustomObjects({
            group: "example.com",
            version: "v1",
            plural: "tests",
            namespaced: true,
          })
          .pipe(Stream.runDrain, Effect.forkScoped);
        yield* Deferred.await(started);
        yield* Fiber.interrupt(fiber);
      }),
    ),
  );

  it.effect("watches Services with namespace filtering through the fake client", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const fake = yield* makeFake();
        const fiber = yield* Kubernetes.watchNamespacedServices({ namespace: "team-a" }).pipe(
          Stream.take(1),
          Stream.runCollect,
          Effect.provide(fake.layer),
          Effect.forkScoped,
        );
        yield* fake.awaitWatch;
        yield* fake.emit(
          { group: "", version: "v1", plural: "services", namespaced: true },
          { type: "Added", object: { metadata: { namespace: "team-b", name: "ignored" } } },
        );
        yield* fake.emit(
          { group: "", version: "v1", plural: "services", namespaced: true },
          { type: "Modified", object: { metadata: { namespace: "team-a", name: "connector" } } },
        );

        const events = yield* Fiber.join(fiber);
        expect(Array.from(events)).toEqual([
          expect.objectContaining({
            type: "Modified",
            object: expect.objectContaining({
              metadata: expect.objectContaining({ namespace: "team-a", name: "connector" }),
            }),
          }),
        ]);
      }),
    ),
  );
});

interface ApiClients {
  readonly core?: Partial<k8s.CoreV1Api>;
}

function makeKubeConfig(clients: ApiClients): k8s.KubeConfig {
  return {
    makeApiClient: (api: unknown) => {
      if (api === k8s.CoreV1Api) return clients.core ?? {};
      return {};
    },
  } as k8s.KubeConfig;
}

function makePartialGroup<A extends object>(group: Partial<A>): A {
  return new Proxy(group, {
    get(target, property, receiver) {
      if (property in target) return Reflect.get(target, property, receiver);
      throw new Error(`Test Kubernetes method is not implemented: ${String(property)}`);
    },
  }) as A;
}
