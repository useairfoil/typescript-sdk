import { KubeConfig } from "@kubernetes/client-node";
import { Config, Effect, Layer } from "effect";

import * as Kubernetes from "./client";

/** Creates a `Kubernetes` layer from a concrete Kubernetes config. */
export const layer = Kubernetes.layer;

/** Creates a `Kubernetes` layer from an Effect `Config` value. */
export const layerConfig = (
  config: Config.Wrap<KubeConfig>,
): Layer.Layer<Kubernetes.Kubernetes, Config.ConfigError> =>
  Layer.effect(
    Kubernetes.Kubernetes,
    Effect.gen(function* () {
      const kubeConfig = yield* Config.unwrap(config);
      return Kubernetes.make(kubeConfig);
    }),
  );

/** Loads Kubernetes config using `@kubernetes/client-node`'s default lookup order. */
export const layerDefault: Layer.Layer<Kubernetes.Kubernetes> = Layer.sync(
  Kubernetes.Kubernetes,
  () => {
    const kubeConfig = new KubeConfig();
    kubeConfig.loadFromDefault();
    return Kubernetes.make(kubeConfig);
  },
);
