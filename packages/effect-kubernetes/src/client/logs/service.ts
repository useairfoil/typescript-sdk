import * as k8s from "@kubernetes/client-node";
import { Cause, Effect, Queue, Stream } from "effect";
import { Writable } from "node:stream";

import type { KubernetesError } from "../../errors";
import type { PodLogStreamRequest } from "../types";

import { mapKubernetesError } from "../../errors";
import { tryKube } from "../helpers";

/** Effect wrappers for Kubernetes Pod log streaming. */
export interface Service {
  /** Streams Pod log chunks through an Effect Stream. */
  readonly streamNamespacedPodLog: (
    params: PodLogStreamRequest,
  ) => Stream.Stream<string, KubernetesError>;
}

/** Creates Pod log wrappers from an upstream Kubernetes Log client. */
export const make = (log: k8s.Log): Service => ({
  streamNamespacedPodLog: (params) =>
    Stream.callback<string, KubernetesError>((queue) =>
      Effect.acquireRelease(
        Effect.gen(function* () {
          const writable = new Writable({
            write(chunk, _encoding, callback) {
              Queue.offerUnsafe(queue, chunk.toString());
              callback();
            },
          });
          writable.on("finish", () => Queue.endUnsafe(queue));
          writable.on("error", (error) => {
            Queue.failCauseUnsafe(queue, Cause.fail(mapKubernetesError(error)));
          });

          const controller = yield* tryKube(() =>
            log.log(params.namespace, params.name, params.container ?? "", writable, {
              follow: params.follow,
              previous: params.previous,
              sinceSeconds: params.sinceSeconds,
              sinceTime:
                params.sinceTime instanceof Date
                  ? params.sinceTime.toISOString()
                  : params.sinceTime,
              timestamps: params.timestamps,
              tailLines: params.tailLines,
              limitBytes: params.limitBytes,
            }),
          );
          return controller;
        }),
        (controller) => Effect.sync(() => controller.abort()),
      ),
    ),
});
