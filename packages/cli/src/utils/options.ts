import { Flag } from "effect/unstable/cli";

/**
 * Common server connection options
 */
export const hostOption = Flag.string("host").pipe(
  Flag.withDescription("Server host"),
  Flag.withDefault("localhost"),
);

export const portOption = Flag.integer("port").pipe(
  Flag.withDescription("Server port"),
  Flag.withAlias("p"),
  Flag.withDefault(7777),
);

/**
 * Common pagination options
 */
export const pageSizeOption = Flag.integer("page-size").pipe(
  Flag.withDescription("Number of items to return (max: 1000)"),
  Flag.withDefault(100),
);

export const pageTokenOption = Flag.optional(
  Flag.string("page-token").pipe(Flag.withDescription("Continuation token for pagination")),
);

/**
 * Force flag for destructive operations
 */
export const forceOption = Flag.boolean("force").pipe(
  Flag.withDescription("Skip confirmation prompt"),
  Flag.withDefault(false),
);
