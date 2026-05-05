import { ClusterClient } from "@useairfoil/wings";

export const makeClusterClientLayer = (host: string, port: number) =>
  ClusterClient.layer({
    host: `${host}:${port}`,
  });
