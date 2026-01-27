import { Schema } from "effect";
import type * as proto from "../proto/cluster_metadata";
import { tag } from "./helpers";

//  ███████████  ███████████      ███████    ███████████    ███████
// ░░███░░░░░███░░███░░░░░███   ███░░░░░███ ░█░░░███░░░█  ███░░░░░███
//  ░███    ░███ ░███    ░███  ███     ░░███░   ░███  ░  ███     ░░███
//  ░██████████  ░██████████  ░███      ░███    ░███    ░███      ░███
//  ░███░░░░░░   ░███░░░░░███ ░███      ░███    ░███    ░███      ░███
//  ░███         ░███    ░███ ░░███     ███     ░███    ░░███     ███
//  █████        █████   █████ ░░░███████░      █████    ░░░███████░
// ░░░░░        ░░░░░   ░░░░░    ░░░░░░░       ░░░░░       ░░░░░░░

const GetObjectStoreRequestProto = Schema.Struct({
  $type: Schema.Literal("wings.v1.cluster_metadata.GetObjectStoreRequest"),
  name: Schema.String,
});

const ListObjectStoresRequestProto = Schema.Struct({
  $type: Schema.Literal("wings.v1.cluster_metadata.ListObjectStoresRequest"),
  parent: Schema.String,
  pageSize: Schema.optional(Schema.Number),
  pageToken: Schema.optional(Schema.String),
});

const DeleteObjectStoreRequestProto = Schema.Struct({
  $type: Schema.Literal("wings.v1.cluster_metadata.DeleteObjectStoreRequest"),
  name: Schema.String,
});

//    █████████   ███████████  ███████████
//   ███░░░░░███ ░░███░░░░░███░░███░░░░░███
//  ░███    ░███  ░███    ░███ ░███    ░███
//  ░███████████  ░██████████  ░██████████
//  ░███░░░░░███  ░███░░░░░░   ░███░░░░░░
//  ░███    ░███  ░███         ░███
//  █████   █████ █████        █████
// ░░░░░   ░░░░░ ░░░░░        ░░░░░

export const AwsConfiguration = Schema.Struct({
  _tag: tag("aws"),
  aws: Schema.Struct({
    bucketName: Schema.String,
    prefix: Schema.optional(Schema.String),
    accessKeyId: Schema.String,
    secretAccessKey: Schema.String,
    region: Schema.optional(Schema.String),
  }),
});

export type AwsConfiguration = typeof AwsConfiguration.Type;

export const AzureConfiguration = Schema.Struct({
  _tag: tag("azure"),
  azure: Schema.Struct({
    containerName: Schema.String,
    prefix: Schema.optional(Schema.String),
    storageAccountName: Schema.String,
    storageAccountKey: Schema.String,
  }),
});

export type AzureConfiguration = typeof AzureConfiguration.Type;

export const GoogleConfiguration = Schema.Struct({
  _tag: tag("google"),
  google: Schema.Struct({
    bucketName: Schema.String,
    prefix: Schema.optional(Schema.String),
    serviceAccount: Schema.String,
    serviceAccountKey: Schema.String,
  }),
});

export type GoogleConfiguration = typeof GoogleConfiguration.Type;

export const S3CompatibleConfiguration = Schema.Struct({
  _tag: tag("s3Compatible"),
  s3Compatible: Schema.Struct({
    bucketName: Schema.String,
    prefix: Schema.optional(Schema.String),
    accessKeyId: Schema.String,
    secretAccessKey: Schema.String,
    region: Schema.optional(Schema.String),
    endpoint: Schema.String,
  }),
});

export type S3CompatibleConfiguration = typeof S3CompatibleConfiguration.Type;

export const ObjectStoreConfig = Schema.Union(
  AwsConfiguration,
  AzureConfiguration,
  GoogleConfiguration,
  S3CompatibleConfiguration,
);

export type ObjectStoreConfig = typeof ObjectStoreConfig.Type;

export const ObjectStore = Schema.Struct({
  name: Schema.String,
  objectStoreConfig: ObjectStoreConfig,
});

export type ObjectStore = typeof ObjectStore.Type;

export const CreateObjectStoreRequest = Schema.Struct({
  parent: Schema.String,
  objectStoreId: Schema.String,
  objectStoreConfig: ObjectStoreConfig,
});

export type CreateObjectStoreRequest = typeof CreateObjectStoreRequest.Type;

const GetObjectStoreRequestApp = Schema.Struct({
  name: Schema.String,
});

const ListObjectStoresRequestApp = Schema.Struct({
  parent: Schema.String,
  pageSize: Schema.optional(Schema.Number),
  pageToken: Schema.optional(Schema.String),
});

export const ListObjectStoresResponse = Schema.Struct({
  objectStores: Schema.Array(ObjectStore),
  nextPageToken: Schema.String,
});

export type ListObjectStoresResponse = typeof ListObjectStoresResponse.Type;

const DeleteObjectStoreRequestApp = Schema.Struct({
  name: Schema.String,
});

//  ███████████ ███████████     █████████   ██████   █████  █████████  ███████████    ███████    ███████████   ██████   ██████   █████████   ███████████ █████    ███████    ██████   █████
// ░█░░░███░░░█░░███░░░░░███   ███░░░░░███ ░░██████ ░░███  ███░░░░░███░░███░░░░░░█  ███░░░░░███ ░░███░░░░░███ ░░██████ ██████   ███░░░░░███ ░█░░░███░░░█░░███   ███░░░░░███ ░░██████ ░░███
// ░   ░███  ░  ░███    ░███  ░███    ░███  ░███░███ ░███ ░███    ░░░  ░███   █ ░  ███     ░░███ ░███    ░███  ░███░█████░███  ░███    ░███ ░   ░███  ░  ░███  ███     ░░███ ░███░███ ░███
//     ░███     ░██████████   ░███████████  ░███░░███░███ ░░█████████  ░███████   ░███      ░███ ░██████████   ░███░░███ ░███  ░███████████     ░███     ░███ ░███      ░███ ░███░░███░███
//     ░███     ░███░░░░░███  ░███░░░░░███  ░███ ░░██████  ░░░░░░░░███ ░███░░░█   ░███      ░███ ░███░░░░░███  ░███ ░░░  ░███  ░███░░░░░███     ░███     ░███ ░███      ░███ ░███ ░░██████
//     ░███     ░███    ░███  ░███    ░███  ░███  ░░█████  ███    ░███ ░███  ░    ░░███     ███  ░███    ░███  ░███      ░███  ░███    ░███     ░███     ░███ ░░███     ███  ░███  ░░█████
//     █████    █████   █████ █████   █████ █████  ░░█████░░█████████  █████       ░░░███████░   █████   █████ █████     █████ █████   █████    █████    █████ ░░░███████░   █████  ░░█████
//    ░░░░░    ░░░░░   ░░░░░ ░░░░░   ░░░░░ ░░░░░    ░░░░░  ░░░░░░░░░  ░░░░░          ░░░░░░░    ░░░░░   ░░░░░ ░░░░░     ░░░░░ ░░░░░   ░░░░░    ░░░░░    ░░░░░    ░░░░░░░    ░░░░░    ░░░░░

export const GetObjectStoreRequest = Schema.transform(
  GetObjectStoreRequestProto,
  GetObjectStoreRequestApp,
  {
    strict: true,
    decode: (proto) => ({ name: proto.name }),
    encode: (app) => ({
      $type: "wings.v1.cluster_metadata.GetObjectStoreRequest" as const,
      name: app.name,
    }),
  },
);

export type GetObjectStoreRequest = typeof GetObjectStoreRequest.Type;

export const ListObjectStoresRequest = Schema.transform(
  ListObjectStoresRequestProto,
  ListObjectStoresRequestApp,
  {
    strict: true,
    decode: (proto) => ({
      parent: proto.parent,
      pageSize: proto.pageSize,
      pageToken: proto.pageToken,
    }),
    encode: (app) => ({
      $type: "wings.v1.cluster_metadata.ListObjectStoresRequest" as const,
      parent: app.parent,
      pageSize: app.pageSize,
      pageToken: app.pageToken,
    }),
  },
);

export type ListObjectStoresRequest = typeof ListObjectStoresRequest.Type;

export const DeleteObjectStoreRequest = Schema.transform(
  DeleteObjectStoreRequestProto,
  DeleteObjectStoreRequestApp,
  {
    strict: true,
    decode: (proto) => ({ name: proto.name }),
    encode: (app) => ({
      $type: "wings.v1.cluster_metadata.DeleteObjectStoreRequest" as const,
      name: app.name,
    }),
  },
);

export type DeleteObjectStoreRequest = typeof DeleteObjectStoreRequest.Type;

//    █████████     ███████    ██████████   ██████████   █████████
//   ███░░░░░███  ███░░░░░███ ░░███░░░░███ ░░███░░░░░█  ███░░░░░███
//  ███     ░░░  ███     ░░███ ░███   ░░███ ░███  █ ░  ███     ░░░
// ░███         ░███      ░███ ░███    ░███ ░██████   ░███
// ░███         ░███      ░███ ░███    ░███ ░███░░█   ░███
// ░░███     ███░░███     ███  ░███    ███  ░███ ░   █░░███     ███
//  ░░█████████  ░░░███████░   ██████████   ██████████ ░░█████████
//   ░░░░░░░░░     ░░░░░░░    ░░░░░░░░░░   ░░░░░░░░░░   ░░░░░░░░░

function objectStoreConfigToProto(
  config: ObjectStoreConfig,
): proto.ObjectStore["objectStoreConfig"] {
  switch (config._tag) {
    case "aws":
      return {
        $case: "aws",
        aws: {
          $type: "wings.v1.cluster_metadata.AwsConfiguration",
          ...config.aws,
        },
      };
    case "azure":
      return {
        $case: "azure",
        azure: {
          $type: "wings.v1.cluster_metadata.AzureConfiguration",
          ...config.azure,
        },
      };
    case "google":
      return {
        $case: "google",
        google: {
          $type: "wings.v1.cluster_metadata.GoogleConfiguration",
          ...config.google,
        },
      };
    case "s3Compatible":
      return {
        $case: "s3Compatible",
        s3Compatible: {
          $type: "wings.v1.cluster_metadata.S3CompatibleConfiguration",
          ...config.s3Compatible,
        },
      };
  }
}

function objectStoreConfigFromProto(
  config: NonNullable<proto.ObjectStore["objectStoreConfig"]>,
): ObjectStoreConfig {
  switch (config.$case) {
    case "aws":
      return {
        _tag: "aws",
        aws: {
          bucketName: config.aws.bucketName,
          prefix: config.aws.prefix,
          accessKeyId: config.aws.accessKeyId,
          secretAccessKey: config.aws.secretAccessKey,
          region: config.aws.region,
        },
      };
    case "azure":
      return {
        _tag: "azure",
        azure: {
          containerName: config.azure.containerName,
          prefix: config.azure.prefix,
          storageAccountName: config.azure.storageAccountName,
          storageAccountKey: config.azure.storageAccountKey,
        },
      };
    case "google":
      return {
        _tag: "google",
        google: {
          bucketName: config.google.bucketName,
          prefix: config.google.prefix,
          serviceAccount: config.google.serviceAccount,
          serviceAccountKey: config.google.serviceAccountKey,
        },
      };
    case "s3Compatible":
      return {
        _tag: "s3Compatible",
        s3Compatible: {
          bucketName: config.s3Compatible.bucketName,
          prefix: config.s3Compatible.prefix,
          accessKeyId: config.s3Compatible.accessKeyId,
          secretAccessKey: config.s3Compatible.secretAccessKey,
          region: config.s3Compatible.region,
          endpoint: config.s3Compatible.endpoint,
        },
      };
  }
}

export const Codec = {
  ObjectStore: {
    toProto: (value: ObjectStore): proto.ObjectStore => ({
      $type: "wings.v1.cluster_metadata.ObjectStore",
      name: value.name,
      objectStoreConfig: objectStoreConfigToProto(value.objectStoreConfig),
    }),
    fromProto: (value: proto.ObjectStore): ObjectStore => {
      if (!value.objectStoreConfig) {
        throw new Error("ObjectStore config is undefined");
      }
      return {
        name: value.name,
        objectStoreConfig: objectStoreConfigFromProto(value.objectStoreConfig),
      };
    },
  },

  CreateObjectStoreRequest: {
    toProto: (
      value: CreateObjectStoreRequest,
    ): proto.CreateObjectStoreRequest => ({
      $type: "wings.v1.cluster_metadata.CreateObjectStoreRequest",
      parent: value.parent,
      objectStoreId: value.objectStoreId,
      objectStore: {
        $type: "wings.v1.cluster_metadata.ObjectStore",
        name: `${value.parent}/object-stores/${value.objectStoreId}`,
        objectStoreConfig: objectStoreConfigToProto(value.objectStoreConfig),
      },
    }),
    fromProto: (
      value: proto.CreateObjectStoreRequest,
    ): CreateObjectStoreRequest => {
      if (!value.objectStore?.objectStoreConfig) {
        throw new Error("ObjectStore metadata is undefined");
      }
      return {
        parent: value.parent,
        objectStoreId: value.objectStoreId,
        objectStoreConfig: objectStoreConfigFromProto(
          value.objectStore.objectStoreConfig,
        ),
      };
    },
  },

  GetObjectStoreRequest: {
    toProto: Schema.encodeSync(GetObjectStoreRequest),
    fromProto: Schema.decodeSync(GetObjectStoreRequest),
  },

  ListObjectStoresRequest: {
    toProto: Schema.encodeSync(ListObjectStoresRequest),
    fromProto: Schema.decodeSync(ListObjectStoresRequest),
  },

  ListObjectStoresResponse: {
    toProto: (
      value: ListObjectStoresResponse,
    ): proto.ListObjectStoresResponse => ({
      $type: "wings.v1.cluster_metadata.ListObjectStoresResponse",
      objectStores: value.objectStores.map(Codec.ObjectStore.toProto),
      nextPageToken: value.nextPageToken,
    }),
    fromProto: (
      value: proto.ListObjectStoresResponse,
    ): ListObjectStoresResponse => ({
      objectStores: value.objectStores.map(Codec.ObjectStore.fromProto),
      nextPageToken: value.nextPageToken,
    }),
  },

  DeleteObjectStoreRequest: {
    toProto: Schema.encodeSync(DeleteObjectStoreRequest),
    fromProto: Schema.decodeSync(DeleteObjectStoreRequest),
  },
} as const;
