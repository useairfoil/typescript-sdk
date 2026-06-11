import { Schema, SchemaTransformation } from "effect";

import { WingsDecodeError } from "../errors";
//  ███████████  ███████████      ███████    ███████████    ███████
// ░░███░░░░░███░░███░░░░░███   ███░░░░░███ ░█░░░███░░░█  ███░░░░░███
//  ░███    ░███ ░███    ░███  ███     ░░███░   ░███  ░  ███     ░░███
//  ░██████████  ░██████████  ░███      ░███    ░███    ░███      ░███
//  ░███░░░░░░   ░███░░░░░███ ░███      ░███    ░███    ░███      ░███
//  ░███         ░███    ░███ ░░███     ███     ░███    ░░███     ███
//  █████        █████   █████ ░░░███████░      █████    ░░░███████░
// ░░░░░        ░░░░░   ░░░░░    ░░░░░░░       ░░░░░       ░░░░░░░

const AwsConfigurationProto = Schema.Struct({
  $case: Schema.Literal("aws"),
  aws: Schema.Struct({
    $type: Schema.Literal("wings.cluster.AwsConfiguration"),
    bucketName: Schema.String,
    prefix: Schema.optional(Schema.String),
    accessKeyId: Schema.String,
    secretAccessKey: Schema.String,
    region: Schema.optional(Schema.String),
  }),
});

const AzureConfigurationProto = Schema.Struct({
  $case: Schema.Literal("azure"),
  azure: Schema.Struct({
    $type: Schema.Literal("wings.cluster.AzureConfiguration"),
    containerName: Schema.String,
    prefix: Schema.optional(Schema.String),
    storageAccountName: Schema.String,
    storageAccountKey: Schema.String,
  }),
});

const GoogleConfigurationProto = Schema.Struct({
  $case: Schema.Literal("google"),
  google: Schema.Struct({
    $type: Schema.Literal("wings.cluster.GoogleConfiguration"),
    bucketName: Schema.String,
    prefix: Schema.optional(Schema.String),
    serviceAccount: Schema.String,
    serviceAccountKey: Schema.String,
  }),
});

const S3CompatibleConfigurationProto = Schema.Struct({
  $case: Schema.Literal("s3Compatible"),
  s3Compatible: Schema.Struct({
    $type: Schema.Literal("wings.cluster.S3CompatibleConfiguration"),
    bucketName: Schema.String,
    prefix: Schema.optional(Schema.String),
    accessKeyId: Schema.String,
    secretAccessKey: Schema.String,
    region: Schema.optional(Schema.String),
    endpoint: Schema.String,
    allowHttp: Schema.Boolean,
  }),
});

export const ObjectStoreConfigProto = Schema.Union([
  AwsConfigurationProto,
  AzureConfigurationProto,
  GoogleConfigurationProto,
  S3CompatibleConfigurationProto,
]);

export type ObjectStoreConfigProto = typeof ObjectStoreConfigProto.Type;

export const ObjectStoreProto = Schema.Struct({
  $type: Schema.Literal("wings.cluster.ObjectStore"),
  objectStoreConfig: Schema.optional(ObjectStoreConfigProto),
});

export type ObjectStoreProto = typeof ObjectStoreProto.Type;

//    █████████   ███████████  ███████████
//   ███░░░░░███ ░░███░░░░░███░░███░░░░░███
//  ░███    ░███  ░███    ░███ ░███    ░███
//  ░███████████  ░██████████  ░██████████
//  ░███░░░░░███  ░███░░░░░░   ░███░░░░░░
//  ░███    ░███  ░███         ░███
//  █████   █████ █████        █████
// ░░░░░   ░░░░░ ░░░░░        ░░░░░

export const AwsConfiguration = Schema.TaggedStruct("aws", {
  aws: Schema.Struct({
    bucketName: Schema.String,
    prefix: Schema.optional(Schema.String),
    accessKeyId: Schema.String,
    secretAccessKey: Schema.String,
    region: Schema.optional(Schema.String),
  }),
});

export type AwsConfiguration = typeof AwsConfiguration.Type;

export const AzureConfiguration = Schema.TaggedStruct("azure", {
  azure: Schema.Struct({
    containerName: Schema.String,
    prefix: Schema.optional(Schema.String),
    storageAccountName: Schema.String,
    storageAccountKey: Schema.String,
  }),
});

export type AzureConfiguration = typeof AzureConfiguration.Type;

export const GoogleConfiguration = Schema.TaggedStruct("google", {
  google: Schema.Struct({
    bucketName: Schema.String,
    prefix: Schema.optional(Schema.String),
    serviceAccount: Schema.String,
    serviceAccountKey: Schema.String,
  }),
});

export type GoogleConfiguration = typeof GoogleConfiguration.Type;

export const S3CompatibleConfiguration = Schema.TaggedStruct("s3Compatible", {
  s3Compatible: Schema.Struct({
    bucketName: Schema.String,
    prefix: Schema.optional(Schema.String),
    accessKeyId: Schema.String,
    secretAccessKey: Schema.String,
    region: Schema.optional(Schema.String),
    endpoint: Schema.String,
    allowHttp: Schema.Boolean,
  }),
});

export type S3CompatibleConfiguration = typeof S3CompatibleConfiguration.Type;

const ObjectStoreConfigApp = Schema.Union([
  AwsConfiguration,
  AzureConfiguration,
  GoogleConfiguration,
  S3CompatibleConfiguration,
]);

type ObjectStoreConfigApp = typeof ObjectStoreConfigApp.Type;

export const ObjectStoreApp = Schema.Struct({
  objectStoreConfig: ObjectStoreConfigApp,
});

export type ObjectStoreApp = typeof ObjectStoreApp.Type;

//  ███████████ ███████████     █████████   ██████   █████  █████████  ███████████    ███████    ███████████   ██████   ██████   █████████   ███████████ █████    ███████    ██████   █████
// ░█░░░███░░░█░░███░░░░░███   ███░░░░░███ ░░██████ ░░███  ███░░░░░███░░███░░░░░░█  ███░░░░░███ ░░███░░░░░███ ░░██████ ██████   ███░░░░░███ ░█░░░███░░░█░░███   ███░░░░░███ ░░██████ ░░███
// ░   ░███  ░  ░███    ░███  ░███    ░███  ░███░███ ░███ ░███    ░░░  ░███   █ ░  ███     ░░███ ░███    ░███  ░███░█████░███  ░███    ░███ ░   ░███  ░  ░███  ███     ░░███ ░███░███ ░███
//     ░███     ░██████████   ░███████████  ░███░░███░███ ░░█████████  ░███████   ░███      ░███ ░██████████   ░███░░███ ░███  ░███████████     ░███     ░███ ░███      ░███ ░███░░███░███
//     ░███     ░███░░░░░███  ░███░░░░░███  ░███ ░░██████  ░░░░░░░░███ ░███░░░█   ░███      ░███ ░███░░░░░███  ░███ ░░░  ░███  ░███░░░░░███     ░███     ░███ ░███      ░███ ░███ ░░██████
//     ░███     ░███    ░███  ░███    ░███  ░███  ░░█████  ███    ░███ ░███  ░    ░░███     ███  ░███    ░███  ░███      ░███  ░███    ░███     ░███     ░███ ░░███     ███  ░███  ░░█████
//     █████    █████   █████ █████   █████ █████  ░░█████░░█████████  █████       ░░░███████░   █████   █████ █████     █████ █████   █████    █████    █████ ░░░███████░   █████  ░░█████
//    ░░░░░    ░░░░░   ░░░░░ ░░░░░   ░░░░░ ░░░░░    ░░░░░  ░░░░░░░░░  ░░░░░          ░░░░░░░    ░░░░░   ░░░░░ ░░░░░     ░░░░░ ░░░░░   ░░░░░    ░░░░░    ░░░░░    ░░░░░░░    ░░░░░    ░░░░░

export const ObjectStoreConfig = ObjectStoreConfigProto.pipe(
  Schema.decodeTo(
    ObjectStoreConfigApp,
    SchemaTransformation.transform({
      decode: (proto): ObjectStoreConfigApp => {
        switch (proto.$case) {
          case "aws":
            return {
              _tag: "aws" as const,
              aws: {
                bucketName: proto.aws.bucketName,
                prefix: proto.aws.prefix,
                accessKeyId: proto.aws.accessKeyId,
                secretAccessKey: proto.aws.secretAccessKey,
                region: proto.aws.region,
              },
            };
          case "azure":
            return {
              _tag: "azure" as const,
              azure: {
                containerName: proto.azure.containerName,
                prefix: proto.azure.prefix,
                storageAccountName: proto.azure.storageAccountName,
                storageAccountKey: proto.azure.storageAccountKey,
              },
            } as const;
          case "google":
            return {
              _tag: "google" as const,
              google: {
                bucketName: proto.google.bucketName,
                prefix: proto.google.prefix,
                serviceAccount: proto.google.serviceAccount,
                serviceAccountKey: proto.google.serviceAccountKey,
              },
            };
          case "s3Compatible":
            return {
              _tag: "s3Compatible" as const,
              s3Compatible: {
                bucketName: proto.s3Compatible.bucketName,
                prefix: proto.s3Compatible.prefix,
                accessKeyId: proto.s3Compatible.accessKeyId,
                secretAccessKey: proto.s3Compatible.secretAccessKey,
                region: proto.s3Compatible.region,
                endpoint: proto.s3Compatible.endpoint,
                allowHttp: proto.s3Compatible.allowHttp,
              },
            };
          default:
            throw new WingsDecodeError("Unsupported object store config");
        }
      },
      encode: (app): ObjectStoreConfigProto => {
        switch (app._tag) {
          case "aws":
            return {
              $case: "aws" as const,
              aws: {
                $type: "wings.cluster.AwsConfiguration" as const,
                bucketName: app.aws.bucketName,
                prefix: app.aws.prefix,
                accessKeyId: app.aws.accessKeyId,
                secretAccessKey: app.aws.secretAccessKey,
                region: app.aws.region,
              },
            };
          case "azure":
            return {
              $case: "azure" as const,
              azure: {
                $type: "wings.cluster.AzureConfiguration" as const,
                containerName: app.azure.containerName,
                prefix: app.azure.prefix,
                storageAccountName: app.azure.storageAccountName,
                storageAccountKey: app.azure.storageAccountKey,
              },
            };
          case "google":
            return {
              $case: "google" as const,
              google: {
                $type: "wings.cluster.GoogleConfiguration" as const,
                bucketName: app.google.bucketName,
                prefix: app.google.prefix,
                serviceAccount: app.google.serviceAccount,
                serviceAccountKey: app.google.serviceAccountKey,
              },
            };
          case "s3Compatible":
            return {
              $case: "s3Compatible" as const,
              s3Compatible: {
                $type: "wings.cluster.S3CompatibleConfiguration" as const,
                bucketName: app.s3Compatible.bucketName,
                prefix: app.s3Compatible.prefix,
                accessKeyId: app.s3Compatible.accessKeyId,
                secretAccessKey: app.s3Compatible.secretAccessKey,
                region: app.s3Compatible.region,
                endpoint: app.s3Compatible.endpoint,
                allowHttp: app.s3Compatible.allowHttp,
              },
            };
          default:
            throw new WingsDecodeError("Unsupported object store config");
        }
      },
    }),
  ),
);

export type ObjectStoreConfig = typeof ObjectStoreConfig.Type;

export const ObjectStore = ObjectStoreProto.pipe(
  Schema.decodeTo(
    ObjectStoreApp,
    SchemaTransformation.transform({
      decode: (proto): ObjectStoreApp => {
        if (!proto.objectStoreConfig) {
          throw new WingsDecodeError("ObjectStore config is undefined");
        }
        return {
          objectStoreConfig: Schema.decodeSync(ObjectStoreConfig)(proto.objectStoreConfig),
        };
      },
      encode: (app): ObjectStoreProto => ({
        $type: "wings.cluster.ObjectStore" as const,
        objectStoreConfig: Schema.encodeSync(ObjectStoreConfig)(app.objectStoreConfig),
      }),
    }),
  ),
);

export type ObjectStore = typeof ObjectStore.Type;
