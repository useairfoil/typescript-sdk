import { Schema, SchemaTransformation } from "effect";

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

type GetObjectStoreRequestProto = typeof GetObjectStoreRequestProto.Type;

const ListObjectStoresRequestProto = Schema.Struct({
  $type: Schema.Literal("wings.v1.cluster_metadata.ListObjectStoresRequest"),
  parent: Schema.String,
  pageSize: Schema.optional(Schema.Number),
  pageToken: Schema.optional(Schema.String),
});

type ListObjectStoresRequestProto = typeof ListObjectStoresRequestProto.Type;

const DeleteObjectStoreRequestProto = Schema.Struct({
  $type: Schema.Literal("wings.v1.cluster_metadata.DeleteObjectStoreRequest"),
  name: Schema.String,
});

type DeleteObjectStoreRequestProto = typeof DeleteObjectStoreRequestProto.Type;

const AwsConfigurationProto = Schema.Struct({
  $case: Schema.Literal("aws"),
  aws: Schema.Struct({
    $type: Schema.Literal("wings.v1.cluster_metadata.AwsConfiguration"),
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
    $type: Schema.Literal("wings.v1.cluster_metadata.AzureConfiguration"),
    containerName: Schema.String,
    prefix: Schema.optional(Schema.String),
    storageAccountName: Schema.String,
    storageAccountKey: Schema.String,
  }),
});

const GoogleConfigurationProto = Schema.Struct({
  $case: Schema.Literal("google"),
  google: Schema.Struct({
    $type: Schema.Literal("wings.v1.cluster_metadata.GoogleConfiguration"),
    bucketName: Schema.String,
    prefix: Schema.optional(Schema.String),
    serviceAccount: Schema.String,
    serviceAccountKey: Schema.String,
  }),
});

const S3CompatibleConfigurationProto = Schema.Struct({
  $case: Schema.Literal("s3Compatible"),
  s3Compatible: Schema.Struct({
    $type: Schema.Literal(
      "wings.v1.cluster_metadata.S3CompatibleConfiguration",
    ),
    bucketName: Schema.String,
    prefix: Schema.optional(Schema.String),
    accessKeyId: Schema.String,
    secretAccessKey: Schema.String,
    region: Schema.optional(Schema.String),
    endpoint: Schema.String,
    allowHttp: Schema.Boolean,
  }),
});

const ObjectStoreConfigProto = Schema.Union([
  AwsConfigurationProto,
  AzureConfigurationProto,
  GoogleConfigurationProto,
  S3CompatibleConfigurationProto,
]);

type ObjectStoreConfigProto = typeof ObjectStoreConfigProto.Type;

const ObjectStoreProto = Schema.Struct({
  $type: Schema.Literal("wings.v1.cluster_metadata.ObjectStore"),
  name: Schema.String,
  objectStoreConfig: Schema.optional(ObjectStoreConfigProto),
});

type ObjectStoreProto = typeof ObjectStoreProto.Type;

const CreateObjectStoreRequestProto = Schema.Struct({
  $type: Schema.Literal("wings.v1.cluster_metadata.CreateObjectStoreRequest"),
  parent: Schema.String,
  objectStoreId: Schema.String,
  objectStore: Schema.optional(ObjectStoreProto),
});

type CreateObjectStoreRequestProto = typeof CreateObjectStoreRequestProto.Type;

const ListObjectStoresResponseProto = Schema.Struct({
  $type: Schema.Literal("wings.v1.cluster_metadata.ListObjectStoresResponse"),
  objectStores: Schema.Array(ObjectStoreProto),
  nextPageToken: Schema.String,
});

type ListObjectStoresResponseProto = typeof ListObjectStoresResponseProto.Type;

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
            throw new Error("Unsupported object store config");
        }
      },
      encode: (app): ObjectStoreConfigProto => {
        switch (app._tag) {
          case "aws":
            return {
              $case: "aws" as const,
              aws: {
                $type: "wings.v1.cluster_metadata.AwsConfiguration" as const,
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
                $type: "wings.v1.cluster_metadata.AzureConfiguration" as const,
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
                $type: "wings.v1.cluster_metadata.GoogleConfiguration" as const,
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
                $type:
                  "wings.v1.cluster_metadata.S3CompatibleConfiguration" as const,
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
            throw new Error("Unsupported object store config");
        }
      },
    }),
  ),
);

export type ObjectStoreConfig = typeof ObjectStoreConfig.Type;

const ObjectStoreApp = Schema.Struct({
  name: Schema.String,
  objectStoreConfig: ObjectStoreConfigApp,
});

type ObjectStoreApp = typeof ObjectStoreApp.Type;

export const ObjectStore = ObjectStoreProto.pipe(
  Schema.decodeTo(
    ObjectStoreApp,
    SchemaTransformation.transform({
      decode: (proto): ObjectStoreApp => {
        if (!proto.objectStoreConfig) {
          throw new Error("ObjectStore config is undefined");
        }
        return {
          name: proto.name,
          objectStoreConfig: Schema.decodeSync(ObjectStoreConfig)(
            proto.objectStoreConfig,
          ),
        };
      },
      encode: (app): ObjectStoreProto => ({
        $type: "wings.v1.cluster_metadata.ObjectStore" as const,
        name: app.name,
        objectStoreConfig: Schema.encodeSync(ObjectStoreConfig)(
          app.objectStoreConfig,
        ),
      }),
    }),
  ),
);

export type ObjectStore = typeof ObjectStore.Type;

const CreateObjectStoreRequestApp = Schema.Struct({
  parent: Schema.String,
  objectStoreId: Schema.String,
  objectStoreConfig: ObjectStoreConfigApp,
});

type CreateObjectStoreRequestApp = typeof CreateObjectStoreRequestApp.Type;

const GetObjectStoreRequestApp = Schema.Struct({
  name: Schema.String,
});

type GetObjectStoreRequestApp = typeof GetObjectStoreRequestApp.Type;

const ListObjectStoresRequestApp = Schema.Struct({
  parent: Schema.String,
  pageSize: Schema.optional(Schema.Number),
  pageToken: Schema.optional(Schema.String),
});

type ListObjectStoresRequestApp = typeof ListObjectStoresRequestApp.Type;

export const ListObjectStoresResponseApp = Schema.Struct({
  objectStores: Schema.Array(ObjectStoreApp),
  nextPageToken: Schema.String,
});

type ListObjectStoresResponseApp = typeof ListObjectStoresResponseApp.Type;

const DeleteObjectStoreRequestApp = Schema.Struct({
  name: Schema.String,
});

type DeleteObjectStoreRequestApp = typeof DeleteObjectStoreRequestApp.Type;

//  ███████████ ███████████     █████████   ██████   █████  █████████  ███████████    ███████    ███████████   ██████   ██████   █████████   ███████████ █████    ███████    ██████   █████
// ░█░░░███░░░█░░███░░░░░███   ███░░░░░███ ░░██████ ░░███  ███░░░░░███░░███░░░░░░█  ███░░░░░███ ░░███░░░░░███ ░░██████ ██████   ███░░░░░███ ░█░░░███░░░█░░███   ███░░░░░███ ░░██████ ░░███
// ░   ░███  ░  ░███    ░███  ░███    ░███  ░███░███ ░███ ░███    ░░░  ░███   █ ░  ███     ░░███ ░███    ░███  ░███░█████░███  ░███    ░███ ░   ░███  ░  ░███  ███     ░░███ ░███░███ ░███
//     ░███     ░██████████   ░███████████  ░███░░███░███ ░░█████████  ░███████   ░███      ░███ ░██████████   ░███░░███ ░███  ░███████████     ░███     ░███ ░███      ░███ ░███░░███░███
//     ░███     ░███░░░░░███  ░███░░░░░███  ░███ ░░██████  ░░░░░░░░███ ░███░░░█   ░███      ░███ ░███░░░░░███  ░███ ░░░  ░███  ░███░░░░░███     ░███     ░███ ░███      ░███ ░███ ░░██████
//     ░███     ░███    ░███  ░███    ░███  ░███  ░░█████  ███    ░███ ░███  ░    ░░███     ███  ░███    ░███  ░███      ░███  ░███    ░███     ░███     ░███ ░░███     ███  ░███  ░░█████
//     █████    █████   █████ █████   █████ █████  ░░█████░░█████████  █████       ░░░███████░   █████   █████ █████     █████ █████   █████    █████    █████ ░░░███████░   █████  ░░█████
//    ░░░░░    ░░░░░   ░░░░░ ░░░░░   ░░░░░ ░░░░░    ░░░░░  ░░░░░░░░░  ░░░░░          ░░░░░░░    ░░░░░   ░░░░░ ░░░░░     ░░░░░ ░░░░░   ░░░░░    ░░░░░    ░░░░░    ░░░░░░░    ░░░░░    ░░░░░

export const GetObjectStoreRequest = GetObjectStoreRequestProto.pipe(
  Schema.decodeTo(
    GetObjectStoreRequestApp,
    SchemaTransformation.transform({
      decode: (proto): GetObjectStoreRequestApp => ({
        name: proto.name,
      }),
      encode: (app): GetObjectStoreRequestProto => ({
        $type: "wings.v1.cluster_metadata.GetObjectStoreRequest" as const,
        name: app.name,
      }),
    }),
  ),
);

export type GetObjectStoreRequest = typeof GetObjectStoreRequest.Type;

export const ListObjectStoresRequest = ListObjectStoresRequestProto.pipe(
  Schema.decodeTo(
    ListObjectStoresRequestApp,
    SchemaTransformation.transform({
      decode: (proto): ListObjectStoresRequestApp => ({
        parent: proto.parent,
        pageSize: proto.pageSize,
        pageToken: proto.pageToken,
      }),
      encode: (app): ListObjectStoresRequestProto => ({
        $type: "wings.v1.cluster_metadata.ListObjectStoresRequest" as const,
        parent: app.parent,
        pageSize: app.pageSize,
        pageToken: app.pageToken,
      }),
    }),
  ),
);

export type ListObjectStoresRequest = typeof ListObjectStoresRequest.Type;

export const CreateObjectStoreRequest = CreateObjectStoreRequestProto.pipe(
  Schema.decodeTo(
    CreateObjectStoreRequestApp,
    SchemaTransformation.transform({
      decode: (proto): CreateObjectStoreRequestApp => {
        if (!proto.objectStore?.objectStoreConfig) {
          throw new Error("ObjectStore metadata is undefined");
        }
        return {
          parent: proto.parent,
          objectStoreId: proto.objectStoreId,
          objectStoreConfig: Schema.decodeSync(ObjectStoreConfig)(
            proto.objectStore.objectStoreConfig,
          ),
        };
      },
      encode: (app): CreateObjectStoreRequestProto => ({
        $type: "wings.v1.cluster_metadata.CreateObjectStoreRequest" as const,
        parent: app.parent,
        objectStoreId: app.objectStoreId,
        objectStore: {
          $type: "wings.v1.cluster_metadata.ObjectStore" as const,
          name: `${app.parent}/object-stores/${app.objectStoreId}`,
          objectStoreConfig: Schema.encodeSync(ObjectStoreConfig)(
            app.objectStoreConfig,
          ),
        },
      }),
    }),
  ),
);

export type CreateObjectStoreRequest = typeof CreateObjectStoreRequest.Type;

export const ListObjectStoresResponse = ListObjectStoresResponseProto.pipe(
  Schema.decodeTo(
    ListObjectStoresResponseApp,
    SchemaTransformation.transform({
      decode: (proto): ListObjectStoresResponseApp => ({
        objectStores: proto.objectStores.map((store) =>
          Schema.decodeSync(ObjectStore)(store),
        ),
        nextPageToken: proto.nextPageToken,
      }),
      encode: (app): ListObjectStoresResponseProto => ({
        $type: "wings.v1.cluster_metadata.ListObjectStoresResponse" as const,
        objectStores: app.objectStores.map((store) =>
          Schema.encodeSync(ObjectStore)(store),
        ),
        nextPageToken: app.nextPageToken,
      }),
    }),
  ),
);

export type ListObjectStoresResponse = typeof ListObjectStoresResponse.Type;

export const DeleteObjectStoreRequest = DeleteObjectStoreRequestProto.pipe(
  Schema.decodeTo(
    DeleteObjectStoreRequestApp,
    SchemaTransformation.transform({
      decode: (proto): DeleteObjectStoreRequestApp => ({
        name: proto.name,
      }),
      encode: (app): DeleteObjectStoreRequestProto => ({
        $type: "wings.v1.cluster_metadata.DeleteObjectStoreRequest" as const,
        name: app.name,
      }),
    }),
  ),
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

export const Codec = {
  ObjectStore: {
    toProto: Schema.encodeSync(ObjectStore),
    fromProto: Schema.decodeSync(ObjectStore),
  },

  CreateObjectStoreRequest: {
    toProto: Schema.encodeSync(CreateObjectStoreRequest),
    fromProto: Schema.decodeSync(CreateObjectStoreRequest),
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
    toProto: Schema.encodeSync(ListObjectStoresResponse),
    fromProto: Schema.decodeSync(ListObjectStoresResponse),
  },

  DeleteObjectStoreRequest: {
    toProto: Schema.encodeSync(DeleteObjectStoreRequest),
    fromProto: Schema.decodeSync(DeleteObjectStoreRequest),
  },
} as const;
