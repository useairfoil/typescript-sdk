import type { ConfigFieldSpec } from "./config";

export type ResourceCapability = "backfill" | "changes" | "webhook";

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

export const define = <const Manifest extends ConnectorManifest>(manifest: Manifest): Manifest =>
  manifest;
