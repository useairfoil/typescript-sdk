import { WingsClusterMetadata } from "@airfoil/wings";

export const makeClusterMetadataLayer = (host: string, port: number) =>
  WingsClusterMetadata.layer({
    host: `${host}:${port}`,
  });
