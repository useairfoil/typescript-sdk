import { ClusterMetadataClient } from "@airfoil/wings";

export function createClusterMetadataClient(host: string, port: string) {
  return new ClusterMetadataClient({
    host: `${host}:${port}`,
  });
}
