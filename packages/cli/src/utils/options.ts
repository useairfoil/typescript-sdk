import { Option } from "commander";

/**
 * Common server connection options
 */
export const hostOption = new Option(
  "-h, --host <host>",
  "Server host",
).default("localhost");

export const portOption = new Option(
  "-p, --port <port>",
  "Server port",
).default("7777");

/**
 * Common pagination options
 */
export const pageSizeOption = new Option(
  "--page-size <size>",
  "Number of items to return (max: 1000)",
).default("100");

export const pageTokenOption = new Option(
  "--page-token <token>",
  "Continuation token for pagination",
);

/**
 * Force flag for destructive operations
 */
export const forceOption = new Option(
  "--force",
  "Skip confirmation prompt",
).default(false);

/**
 * Common option types
 */
export type ServerOptions = {
  host: string;
  port: string;
};

export type PaginationOptions = {
  pageSize: string;
  pageToken?: string;
};

export type ForceOptions = {
  force: boolean;
};

export type ServerAndForceOptions = ServerOptions & ForceOptions;

export type ServerAndPaginationOptions = ServerOptions & PaginationOptions;
