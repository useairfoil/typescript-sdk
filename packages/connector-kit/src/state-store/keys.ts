import type { StateSource } from "./schema";

type StateComponent = StateSource | `error:${StateSource}`;

export const resourceComponentKey = (resource: string, component: StateComponent): string =>
  `resource:${resource}:${component}`;

export const resourceErrorKey = (resource: string, source: StateSource): string =>
  resourceComponentKey(resource, `error:${source}`);

/**
 * Prefix for all state owned by one connector instance. The platform-owned ID
 * stays visible so operators can inspect and clean up shared-table rows directly.
 *
 * @example
 * ```ts
 * connectorInstanceKeyPrefix("team-a/orders");
 * // "connector-instance:team-a/orders:"
 * ```
 */
export const connectorInstanceKeyPrefix = (connectorInstanceId: string): string =>
  `connector-instance:${connectorInstanceId}:`;
