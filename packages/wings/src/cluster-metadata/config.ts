import type { CallOptions } from "nice-grpc";

/**
 * Configuration shape for ClusterMetadata client
 */
export interface ClusterMetadataParams {
  /**
   * The gRPC host address
   * @example "localhost:7777"
   * @example "wings.example.com:7777"
   */
  readonly host: string;

  /**
   * Call options accepted by client methods.
   */
  readonly callOptions?: CallOptions;
}
