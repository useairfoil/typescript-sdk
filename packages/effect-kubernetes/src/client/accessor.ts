import { Effect } from "effect";

import type { Service } from "./service";

import { Kubernetes } from "./context";

/** Retrieves the `Kubernetes` service from the Effect context. */
export const service = Effect.service(Kubernetes);

/** Builds a standalone accessor from a `Kubernetes` service method. */
export const access = <A, E>(
  f: (kubernetes: Service) => Effect.Effect<A, E>,
): Effect.Effect<A, E, Kubernetes> => Effect.flatMap(service, f);

/** Retrieves CoreV1 operations from the `Kubernetes` service in context. */
export const Core = Effect.map(service, (kubernetes) => kubernetes.core);

/** Retrieves AppsV1 operations from the `Kubernetes` service in context. */
export const Apps = Effect.map(service, (kubernetes) => kubernetes.apps);

/** Retrieves BatchV1 operations from the `Kubernetes` service in context. */
export const Batch = Effect.map(service, (kubernetes) => kubernetes.batch);

/** Retrieves RBAC operations from the `Kubernetes` service in context. */
export const Rbac = Effect.map(service, (kubernetes) => kubernetes.rbac);

/** Retrieves NetworkingV1 operations from the `Kubernetes` service in context. */
export const Networking = Effect.map(service, (kubernetes) => kubernetes.networking);

/** Retrieves ApiextensionsV1 operations from the `Kubernetes` service in context. */
export const ApiExtensions = Effect.map(service, (kubernetes) => kubernetes.apiExtensions);

/** Retrieves CustomObjectsApi operations from the `Kubernetes` service in context. */
export const CustomObjects = Effect.map(service, (kubernetes) => kubernetes.customObjects);

/** Retrieves Pod log operations from the `Kubernetes` service in context. */
export const Logs = Effect.map(service, (kubernetes) => kubernetes.logs);

/** Retrieves watch operations from the `Kubernetes` service in context. */
export const Watch = Effect.map(service, (kubernetes) => kubernetes.watch);
