import { Effect, Option } from "effect";

import type { KubernetesError } from "../errors";

import { isNotFound, mapKubernetesError } from "../errors";

/** Converts an upstream Kubernetes client Promise into an Effect with `KubernetesError`. */
export const tryKube = <A>(evaluate: () => Promise<A>): Effect.Effect<A, KubernetesError> =>
  Effect.tryPromise({ try: evaluate, catch: mapKubernetesError });

/** Converts a single-object upstream request into an Effect `Option`, mapping 404 to `Option.none`. */
export const tryKubeOption = <A>(
  evaluate: () => Promise<A>,
): Effect.Effect<Option.Option<A>, KubernetesError> =>
  tryKube(evaluate).pipe(
    Effect.map(Option.some),
    Effect.catchIf(isNotFound, () => Effect.succeedNone),
  );
