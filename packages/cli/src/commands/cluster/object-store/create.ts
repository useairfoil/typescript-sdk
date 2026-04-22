import { Effect } from "effect";
import { Command } from "effect/unstable/cli";

import { createObjectStoreAwsCommand } from "./create-aws.js";
import { createObjectStoreAzureCommand } from "./create-azure.js";
import { createObjectStoreGoogleCommand } from "./create-google.js";
import { createObjectStoreS3Command } from "./create-s3.js";

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
