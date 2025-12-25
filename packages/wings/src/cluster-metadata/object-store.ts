import { type Codec, type CodecType, OneOfCodec } from "../lib/codec";
import type * as proto from "../proto/cluster_metadata";

export const AwsConfiguration: Codec<
  {
    /** Bucket name. */
    bucketName: string;
    /** Bucket prefix. */
    prefix?: string;
    /** `AWS_ACCESS_KEY_ID` */
    accessKeyId: string;
    /** `AWS_SECRET_ACCESS_KEY` */
    secretAccessKey: string;
    /** `AWS_DEFAULT_REGION` */
    region?: string;
  },
  proto.AwsConfiguration
> = {
  encode(value) {
    return {
      $type: "wings.v1.cluster_metadata.AwsConfiguration",
      bucketName: value.bucketName,
      prefix: value.prefix,
      accessKeyId: value.accessKeyId,
      secretAccessKey: value.secretAccessKey,
      region: value.region,
    };
  },
  decode(value) {
    return {
      bucketName: value.bucketName,
      prefix: value.prefix,
      accessKeyId: value.accessKeyId,
      secretAccessKey: value.secretAccessKey,
      region: value.region,
    };
  },
};

export type AwsConfiguration = CodecType<typeof AwsConfiguration>;

export const AzureConfiguration: Codec<
  {
    /** Azure container name. */
    containerName: string;
    /** Container prefix. */
    prefix?: string;
    /** `AZURE_STORAGE_ACCOUNT_NAME` */
    storageAccountName: string;
    /** `AZURE_STORAGE_ACCOUNT_KEY` */
    storageAccountKey: string;
  },
  proto.AzureConfiguration
> = {
  encode(value) {
    return {
      $type: "wings.v1.cluster_metadata.AzureConfiguration",
      containerName: value.containerName,
      prefix: value.prefix,
      storageAccountName: value.storageAccountName,
      storageAccountKey: value.storageAccountKey,
    };
  },
  decode(value) {
    return {
      containerName: value.containerName,
      prefix: value.prefix,
      storageAccountName: value.storageAccountName,
      storageAccountKey: value.storageAccountKey,
    };
  },
};

export type AzureConfiguration = CodecType<typeof AzureConfiguration>;

export const GoogleConfiguration: Codec<
  {
    /** Bucket name. */
    bucketName: string;
    /** Bucket prefix. */
    prefix?: string;
    /** `GOOGLE_SERVICE_ACCOUNT` */
    serviceAccount: string;
    /** `GOOGLE_SERVICE_ACCOUNT_KEY` */
    serviceAccountKey: string;
  },
  proto.GoogleConfiguration
> = {
  encode(value) {
    return {
      $type: "wings.v1.cluster_metadata.GoogleConfiguration",
      bucketName: value.bucketName,
      prefix: value.prefix,
      serviceAccount: value.serviceAccount,
      serviceAccountKey: value.serviceAccountKey,
    };
  },
  decode(value) {
    return {
      bucketName: value.bucketName,
      prefix: value.prefix,
      serviceAccount: value.serviceAccount,
      serviceAccountKey: value.serviceAccountKey,
    };
  },
};

export type GoogleConfiguration = CodecType<typeof GoogleConfiguration>;

export const S3CompatibleConfiguration: Codec<
  {
    /** Bucket name. */
    bucketName: string;
    /** Bucket prefix. */
    prefix?: string;
    /** `AWS_ACCESS_KEY_ID` */
    accessKeyId: string;
    /** `AWS_SECRET_ACCESS_KEY` */
    secretAccessKey: string;
    /** `AWS_DEFAULT_REGION` */
    region?: string;
    /** `AWS_ENDPOINT` */
    endpoint: string;
  },
  proto.S3CompatibleConfiguration
> = {
  encode(value) {
    return {
      $type: "wings.v1.cluster_metadata.S3CompatibleConfiguration",
      bucketName: value.bucketName,
      prefix: value.prefix,
      accessKeyId: value.accessKeyId,
      secretAccessKey: value.secretAccessKey,
      region: value.region,
      endpoint: value.endpoint,
    };
  },
  decode(value) {
    return {
      bucketName: value.bucketName,
      prefix: value.prefix,
      accessKeyId: value.accessKeyId,
      secretAccessKey: value.secretAccessKey,
      region: value.region,
      endpoint: value.endpoint,
    };
  },
};

export type S3CompatibleConfiguration = CodecType<
  typeof S3CompatibleConfiguration
>;

export const ObjectStoreConfig = OneOfCodec({
  aws: AwsConfiguration,
  azure: AzureConfiguration,
  google: GoogleConfiguration,
  s3Compatible: S3CompatibleConfiguration,
});

export type ObjectStoreConfig = CodecType<typeof ObjectStoreConfig>;

export const CreateObjectStoreRequest: Codec<
  {
    /**
     * The tenant that owns the object store.
     *
     * Format: tenants/{tenant}
     */
    parent: string;
    /** The object store id. */
    objectStoreId: string;
    /** Object store configuration. */
    objectStoreConfig: ObjectStoreConfig;
  },
  proto.CreateObjectStoreRequest
> = {
  encode(value) {
    return {
      $type: "wings.v1.cluster_metadata.CreateObjectStoreRequest",
      parent: value.parent,
      objectStoreId: value.objectStoreId,
      objectStore: ObjectStore.encode({
        name: `${value.parent}/object-stores/${value.objectStoreId}`,
        objectStoreConfig: value.objectStoreConfig,
      }),
    };
  },
  decode(value) {
    if (value.objectStore === undefined) {
      throw new Error("ObjectStore metadata is undefined");
    }

    const decoded = ObjectStore.decode(value.objectStore);
    return {
      parent: value.parent,
      objectStoreId: value.objectStoreId,
      objectStoreConfig: decoded.objectStoreConfig,
    };
  },
};

export type CreateObjectStoreRequest = CodecType<
  typeof CreateObjectStoreRequest
>;

export const GetObjectStoreRequest: Codec<
  {
    /**
     * The object store name.
     *
     * Format: tenants/{tenant}/object-stores/{object-store}
     */
    name: string;
  },
  proto.GetObjectStoreRequest
> = {
  encode(value) {
    return {
      $type: "wings.v1.cluster_metadata.GetObjectStoreRequest",
      name: value.name,
    };
  },
  decode(value) {
    return {
      name: value.name,
    };
  },
};

export type GetObjectStoreRequest = CodecType<typeof GetObjectStoreRequest>;

export const ListObjectStoresRequest: Codec<
  {
    /**
     * The parent tenant.
     *
     * Format: tenants/{tenant}
     */
    parent: string;
    /** The number of object stores to return. */
    pageSize?: number;
    /** The continuation token. */
    pageToken?: string;
  },
  proto.ListObjectStoresRequest
> = {
  encode(value) {
    return {
      $type: "wings.v1.cluster_metadata.ListObjectStoresRequest",
      parent: value.parent,
      pageSize: value.pageSize,
      pageToken: value.pageToken,
    };
  },
  decode(value) {
    return {
      parent: value.parent,
      pageSize: value.pageSize,
      pageToken: value.pageToken,
    };
  },
};

export type ListObjectStoresRequest = CodecType<typeof ListObjectStoresRequest>;

export const ListObjectStoresResponse: Codec<
  {
    /** The object stores. */
    objectStores: ObjectStore[];
    /** The continuation token. */
    nextPageToken: string;
  },
  proto.ListObjectStoresResponse
> = {
  encode(value) {
    return {
      $type: "wings.v1.cluster_metadata.ListObjectStoresResponse",
      objectStores: value.objectStores.map(ObjectStore.encode),
      nextPageToken: value.nextPageToken,
    };
  },
  decode(value) {
    return {
      objectStores: value.objectStores.map(ObjectStore.decode),
      nextPageToken: value.nextPageToken,
    };
  },
};

export type ListObjectStoresResponse = CodecType<
  typeof ListObjectStoresResponse
>;

export const DeleteObjectStoreRequest: Codec<
  {
    /**
     * The object store name.
     *
     * Format: tenants/{tenant}/object-stores/{object-store}
     */
    name: string;
  },
  proto.DeleteObjectStoreRequest
> = {
  encode(value) {
    return {
      $type: "wings.v1.cluster_metadata.DeleteObjectStoreRequest",
      name: value.name,
    };
  },
  decode(value) {
    return {
      name: value.name,
    };
  },
};

export type DeleteObjectStoreRequest = CodecType<
  typeof DeleteObjectStoreRequest
>;

export const ObjectStore: Codec<
  {
    /**
     * The object store name.
     *
     * Format: tenants/{tenant}/object-stores/{object-store}
     */
    name: string;
    /** Object store configuration. */
    objectStoreConfig: ObjectStoreConfig;
  },
  proto.ObjectStore
> = {
  encode(value) {
    return {
      $type: "wings.v1.cluster_metadata.ObjectStore",
      name: value.name,
      objectStoreConfig: value.objectStoreConfig
        ? ObjectStoreConfig.encode(value.objectStoreConfig)
        : undefined,
    };
  },
  decode(value) {
    if (value.objectStoreConfig === undefined) {
      throw new Error("ObjectStoreConfig is undefined");
    }
    return {
      name: value.name,
      objectStoreConfig: ObjectStoreConfig.decode(value.objectStoreConfig),
    };
  },
};

export type ObjectStore = CodecType<typeof ObjectStore>;
