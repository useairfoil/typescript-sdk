import { Schema } from "effect";
import type * as proto from "../../proto/cluster_metadata";
import { tag } from "./helpers";

export const AwsConfiguration = Schema.Struct({
  _tag: tag("aws"),
  aws: Schema.Struct({
    /** Bucket name. */
    bucketName: Schema.String,
    /** Bucket prefix. */
    prefix: Schema.optional(Schema.String),
    /** `AWS_ACCESS_KEY_ID` */
    accessKeyId: Schema.String,
    /** `AWS_SECRET_ACCESS_KEY` */
    secretAccessKey: Schema.String,
    /** `AWS_DEFAULT_REGION` */
    region: Schema.optional(Schema.String),
  }),
});

export type AwsConfiguration = typeof AwsConfiguration.Type;

export const AzureConfiguration = Schema.Struct({
  _tag: tag("azure"),
  azure: Schema.Struct({
    /** Azure container name. */
    containerName: Schema.String,
    /** Container prefix. */
    prefix: Schema.optional(Schema.String),
    /** `AZURE_STORAGE_ACCOUNT_NAME` */
    storageAccountName: Schema.String,
    /** `AZURE_STORAGE_ACCOUNT_KEY` */
    storageAccountKey: Schema.String,
  }),
});

export type AzureConfiguration = typeof AzureConfiguration.Type;

export const GoogleConfiguration = Schema.Struct({
  _tag: tag("google"),
  google: Schema.Struct({
    /** Bucket name. */
    bucketName: Schema.String,
    /** Bucket prefix. */
    prefix: Schema.optional(Schema.String),
    /** `GOOGLE_SERVICE_ACCOUNT` */
    serviceAccount: Schema.String,
    /** `GOOGLE_SERVICE_ACCOUNT_KEY` */
    serviceAccountKey: Schema.String,
  }),
});

export type GoogleConfiguration = typeof GoogleConfiguration.Type;

export const S3CompatibleConfiguration = Schema.Struct({
  _tag: tag("s3Compatible"),
  s3Compatible: Schema.Struct({
    /** Bucket name. */
    bucketName: Schema.String,
    /** Bucket prefix. */
    prefix: Schema.optional(Schema.String),
    /** `AWS_ACCESS_KEY_ID` */
    accessKeyId: Schema.String,
    /** `AWS_SECRET_ACCESS_KEY` */
    secretAccessKey: Schema.String,
    /** `AWS_DEFAULT_REGION` */
    region: Schema.optional(Schema.String),
    /** `AWS_ENDPOINT` */
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

export const CreateObjectStoreRequest = Schema.Struct({
  /**
   * The tenant that owns the object store.
   *
   * Format: tenants/{tenant}
   */
  parent: Schema.String,
  /** The object store id. */
  objectStoreId: Schema.String,
  /** Object store configuration. */
  objectStoreConfig: ObjectStoreConfig,
});

export type CreateObjectStoreRequest = typeof CreateObjectStoreRequest.Type;

export const GetObjectStoreRequest = Schema.Struct({
  /**
   * The object store name.
   *
   * Format: tenants/{tenant}/object-stores/{object-store}
   */
  name: Schema.String,
});

export type GetObjectStoreRequest = typeof GetObjectStoreRequest.Type;

export const ListObjectStoresRequest = Schema.Struct({
  /**
   * The parent tenant.
   *
   * Format: tenants/{tenant}
   */
  parent: Schema.String,
  /** The number of object stores to return. */
  pageSize: Schema.optional(Schema.Number),
  /** The continuation token. */
  pageToken: Schema.optional(Schema.String),
});

export type ListObjectStoresRequest = typeof ListObjectStoresRequest.Type;

export const ObjectStore = Schema.Struct({
  /**
   * The object store name.
   *
   * Format: tenants/{tenant}/object-stores/{object-store}
   */
  name: Schema.String,
  /** Object store configuration. */
  objectStoreConfig: ObjectStoreConfig,
});

export type ObjectStore = typeof ObjectStore.Type;

export const ListObjectStoresResponse = Schema.Struct({
  /** The object stores. */
  objectStores: Schema.Array(ObjectStore),
  /** The continuation token. */
  nextPageToken: Schema.String,
});

export type ListObjectStoresResponse = typeof ListObjectStoresResponse.Type;

export const DeleteObjectStoreRequest = Schema.Struct({
  /**
   * The object store name.
   *
   * Format: tenants/{tenant}/object-stores/{object-store}
   */
  name: Schema.String,
});

export type DeleteObjectStoreRequest = typeof DeleteObjectStoreRequest.Type;

export const Codec = {
  AwsConfiguration: {
    toProto: (value: AwsConfiguration): proto.AwsConfiguration => ({
      $type: "wings.v1.cluster_metadata.AwsConfiguration",
      bucketName: value.aws.bucketName,
      prefix: value.aws.prefix,
      accessKeyId: value.aws.accessKeyId,
      secretAccessKey: value.aws.secretAccessKey,
      region: value.aws.region,
    }),
    fromProto: (value: proto.AwsConfiguration): AwsConfiguration => ({
      _tag: "aws",
      aws: {
        bucketName: value.bucketName,
        prefix: value.prefix,
        accessKeyId: value.accessKeyId,
        secretAccessKey: value.secretAccessKey,
        region: value.region,
      },
    }),
  },

  AzureConfiguration: {
    toProto: (value: AzureConfiguration): proto.AzureConfiguration => ({
      $type: "wings.v1.cluster_metadata.AzureConfiguration",
      containerName: value.azure.containerName,
      prefix: value.azure.prefix,
      storageAccountName: value.azure.storageAccountName,
      storageAccountKey: value.azure.storageAccountKey,
    }),
    fromProto: (value: proto.AzureConfiguration): AzureConfiguration => ({
      _tag: "azure",
      azure: {
        containerName: value.containerName,
        prefix: value.prefix,
        storageAccountName: value.storageAccountName,
        storageAccountKey: value.storageAccountKey,
      },
    }),
  },

  GoogleConfiguration: {
    toProto: (value: GoogleConfiguration): proto.GoogleConfiguration => ({
      $type: "wings.v1.cluster_metadata.GoogleConfiguration",
      bucketName: value.google.bucketName,
      prefix: value.google.prefix,
      serviceAccount: value.google.serviceAccount,
      serviceAccountKey: value.google.serviceAccountKey,
    }),
    fromProto: (value: proto.GoogleConfiguration): GoogleConfiguration => ({
      _tag: "google",
      google: {
        bucketName: value.bucketName,
        prefix: value.prefix,
        serviceAccount: value.serviceAccount,
        serviceAccountKey: value.serviceAccountKey,
      },
    }),
  },

  S3CompatibleConfiguration: {
    toProto: (
      value: S3CompatibleConfiguration,
    ): proto.S3CompatibleConfiguration => ({
      $type: "wings.v1.cluster_metadata.S3CompatibleConfiguration",
      bucketName: value.s3Compatible.bucketName,
      prefix: value.s3Compatible.prefix,
      accessKeyId: value.s3Compatible.accessKeyId,
      secretAccessKey: value.s3Compatible.secretAccessKey,
      region: value.s3Compatible.region,
      endpoint: value.s3Compatible.endpoint,
    }),
    fromProto: (
      value: proto.S3CompatibleConfiguration,
    ): S3CompatibleConfiguration => ({
      _tag: "s3Compatible",
      s3Compatible: {
        bucketName: value.bucketName,
        prefix: value.prefix,
        accessKeyId: value.accessKeyId,
        secretAccessKey: value.secretAccessKey,
        region: value.region,
        endpoint: value.endpoint,
      },
    }),
  },

  ObjectStoreConfig: {
    toProto: (
      value: ObjectStoreConfig,
    ): proto.ObjectStore["objectStoreConfig"] => {
      switch (value._tag) {
        case "aws":
          return { $case: "aws", aws: Codec.AwsConfiguration.toProto(value) };
        case "azure":
          return {
            $case: "azure",
            azure: Codec.AzureConfiguration.toProto(value),
          };
        case "google":
          return {
            $case: "google",
            google: Codec.GoogleConfiguration.toProto(value),
          };
        case "s3Compatible":
          return {
            $case: "s3Compatible",
            s3Compatible: Codec.S3CompatibleConfiguration.toProto(value),
          };
      }
    },
    fromProto: (
      value: proto.ObjectStore["objectStoreConfig"],
    ): ObjectStoreConfig => {
      if (!value) {
        throw new Error("ObjectStoreConfig is undefined");
      }
      switch (value.$case) {
        case "aws":
          return Codec.AwsConfiguration.fromProto(value.aws);
        case "azure":
          return Codec.AzureConfiguration.fromProto(value.azure);
        case "google":
          return Codec.GoogleConfiguration.fromProto(value.google);
        case "s3Compatible":
          return Codec.S3CompatibleConfiguration.fromProto(value.s3Compatible);
        default:
          throw new Error(`Unknown ObjectStoreConfig type`);
      }
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
        objectStoreConfig: Codec.ObjectStoreConfig.toProto(
          value.objectStoreConfig,
        ),
      },
    }),
    fromProto: (
      value: proto.CreateObjectStoreRequest,
    ): CreateObjectStoreRequest => {
      if (
        value.objectStore === undefined ||
        !value.objectStore.objectStoreConfig
      ) {
        throw new Error("ObjectStore metadata is undefined");
      }
      return {
        parent: value.parent,
        objectStoreId: value.objectStoreId,
        objectStoreConfig: Codec.ObjectStoreConfig.fromProto(
          value.objectStore.objectStoreConfig,
        ),
      };
    },
  },

  ObjectStore: {
    toProto: (value: ObjectStore): proto.ObjectStore => ({
      $type: "wings.v1.cluster_metadata.ObjectStore",
      name: value.name,
      objectStoreConfig: Codec.ObjectStoreConfig.toProto(
        value.objectStoreConfig,
      ),
    }),
    fromProto: (value: proto.ObjectStore): ObjectStore => {
      if (!value.objectStoreConfig) {
        throw new Error("ObjectStore config is undefined");
      }
      return {
        name: value.name,
        objectStoreConfig: Codec.ObjectStoreConfig.fromProto(
          value.objectStoreConfig,
        ),
      };
    },
  },

  GetObjectStoreRequest: {
    toProto: (value: GetObjectStoreRequest): proto.GetObjectStoreRequest => ({
      $type: "wings.v1.cluster_metadata.GetObjectStoreRequest",
      name: value.name,
    }),
    fromProto: (value: proto.GetObjectStoreRequest): GetObjectStoreRequest => ({
      name: value.name,
    }),
  },

  ListObjectStoresRequest: {
    toProto: (
      value: ListObjectStoresRequest,
    ): proto.ListObjectStoresRequest => ({
      $type: "wings.v1.cluster_metadata.ListObjectStoresRequest",
      parent: value.parent,
      pageSize: value.pageSize,
      pageToken: value.pageToken,
    }),
    fromProto: (
      value: proto.ListObjectStoresRequest,
    ): ListObjectStoresRequest => ({
      parent: value.parent,
      pageSize: value.pageSize,
      pageToken: value.pageToken,
    }),
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
    toProto: (
      value: DeleteObjectStoreRequest,
    ): proto.DeleteObjectStoreRequest => ({
      $type: "wings.v1.cluster_metadata.DeleteObjectStoreRequest",
      name: value.name,
    }),
    fromProto: (
      value: proto.DeleteObjectStoreRequest,
    ): DeleteObjectStoreRequest => ({
      name: value.name,
    }),
  },
} as const;
