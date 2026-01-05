import { Command } from "commander";
import { createObjectStoreAwsCommand } from "./create-aws.js";
import { createObjectStoreAzureCommand } from "./create-azure.js";
import { createObjectStoreGoogleCommand } from "./create-google.js";
import { createObjectStoreS3Command } from "./create-s3.js";

export const createObjectStoreCommand = new Command("create-object-store")
  .description("Create a new object store")
  .addCommand(createObjectStoreAwsCommand)
  .addCommand(createObjectStoreAzureCommand)
  .addCommand(createObjectStoreGoogleCommand)
  .addCommand(createObjectStoreS3Command);
