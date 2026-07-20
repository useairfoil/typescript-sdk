import * as k8s from "@kubernetes/client-node";
import { Data } from "effect";

/** Error type used by the Effect wrapper around `@kubernetes/client-node`. */
export class KubernetesError extends Data.TaggedError("KubernetesError")<{
  readonly message: string;
  readonly code?: number;
  readonly body?: unknown;
  readonly headers?: Record<string, string>;
  readonly cause?: unknown;
}> {}

/** Maps errors thrown by `@kubernetes/client-node` into `KubernetesError`. */
export const mapKubernetesError = (error: unknown): KubernetesError => {
  if (error instanceof k8s.ApiException) {
    return new KubernetesError({
      message: error.message,
      code: error.code,
      body: error.body,
      headers: error.headers,
      cause: error,
    });
  }

  return new KubernetesError({
    message: error instanceof Error ? error.message : String(error),
    cause: error,
  });
};

/** Returns true when the Kubernetes API reported that the object does not exist. */
export const isNotFound = (error: KubernetesError): boolean => error.code === 404;

/** Returns true when the Kubernetes API reported a write conflict. */
export const isConflict = (error: KubernetesError): boolean => error.code === 409;
