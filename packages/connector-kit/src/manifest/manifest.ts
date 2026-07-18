import type { ConfigFieldSpec } from "./config";

export type ResourceCapability = "backfill" | "changes" | "webhook";

/** Browser-safe connector metadata consumed by the platform and runtime adapters. */
export type ConnectorManifest = {
  readonly name: string;
  readonly title: string;
  readonly description?: string;
  readonly config: ReadonlyArray<ConfigFieldSpec>;
  readonly resources: ReadonlyArray<{
    readonly name: string;
    readonly capabilities: ReadonlyArray<ResourceCapability>;
  }>;
};

/**
 * Defines browser-safe connector metadata while preserving literal names and capabilities.
 *
 * @example
 * ```ts
 * const manifest = define({
 *   name: "producer-example",
 *   title: "Example",
 *   config: ExampleConfig.spec,
 *   resources: [{ name: "orders", capabilities: ["backfill"] }],
 * });
 * ```
 */
export const define = <const Manifest extends ConnectorManifest>(manifest: Manifest): Manifest =>
  manifest;
