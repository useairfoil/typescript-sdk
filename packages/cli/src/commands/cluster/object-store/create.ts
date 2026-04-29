import { Effect } from "effect";
import { Command } from "effect/unstable/cli";

import { createObjectStoreAwsCommand } from "./create-aws";
import { createObjectStoreAzureCommand } from "./create-azure";
import { createObjectStoreGoogleCommand } from "./create-google";
import { createObjectStoreS3Command } from "./create-s3";

export const createObjectStoreCommand = Command.make(
  "create-object-store",
  {},
  () => Effect.void,
).pipe(
  Command.withDescription("Create a new object store"),
  Command.withSubcommands([
    createObjectStoreAwsCommand,
    createObjectStoreAzureCommand,
    createObjectStoreGoogleCommand,
    createObjectStoreS3Command,
  ]),
);
