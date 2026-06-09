import * as p from "@clack/prompts";
import { Cluster, ClusterClient } from "@useairfoil/wings";
import { printTable } from "console-table-printer";
import { Config, Effect, Option, Redacted } from "effect";
import { Command, Flag } from "effect/unstable/cli";

import { makeClusterClientLayer } from "../../../utils/client";
import { hostOption, portOption } from "../../../utils/options";

type LakeTag = Cluster.Lake.LakeApp["lakeConfig"]["_tag"];

const namespaceIdOption = Flag.string("namespace-id").pipe(
  Flag.withDescription("Unique identifier for the namespace (e.g., 'production')"),
);

const lakeOption = Flag.string("lake").pipe(
  Flag.withDescription("Lake format: iceberg, parquet, or delta"),
  Flag.withDefault("iceberg" as LakeTag),
);

const prefixOption = Flag.string("prefix").pipe(
  Flag.withDescription("Storage prefix (optional)"),
  Flag.optional,
);

function makeLakeConfig(lake: string): Cluster.Lake.LakeApp {
  switch (lake) {
    case "iceberg":
      return { lakeConfig: { _tag: "iceberg" as const, iceberg: {} } };
    case "parquet":
      return { lakeConfig: { _tag: "parquet" as const, parquet: {} } };
    case "delta":
      return { lakeConfig: { _tag: "delta" as const, delta: {} } };
    default:
      throw new Error(`Invalid lake type: "${lake}". Must be iceberg, parquet, or delta.`);
  }
}

function displayNamespace(namespace: Cluster.Namespace.Namespace) {
  printTable([
    {
      name: namespace.name,
      object_store: namespace.objectStore?.objectStoreConfig._tag ?? "-",
      lake: namespace.lake?.lakeConfig._tag ?? "-",
    },
  ]);
  p.outro("✓ Done");
}

// ─── AWS ──────────────────────────────────────────────────────────────────────

const createNamespaceAwsCommand = Command.make(
  "aws",
  {
    namespaceId: namespaceIdOption,
    lake: lakeOption,
    bucketName: Flag.string("bucket-name").pipe(Flag.withDescription("AWS S3 bucket name")),
    prefix: prefixOption,
    accessKeyId: Flag.redacted("access-key-id").pipe(
      Flag.withDescription("AWS access key ID (or set AWS_ACCESS_KEY_ID env var)"),
      Flag.withFallbackConfig(Config.redacted("AWS_ACCESS_KEY_ID")),
    ),
    secretAccessKey: Flag.redacted("secret-access-key").pipe(
      Flag.withDescription("AWS secret access key (or set AWS_SECRET_ACCESS_KEY env var)"),
      Flag.withFallbackConfig(Config.redacted("AWS_SECRET_ACCESS_KEY")),
    ),
    region: Flag.string("region").pipe(
      Flag.withDescription("AWS region (e.g., us-east-1)"),
      Flag.optional,
    ),
    host: hostOption,
    port: portOption,
  },
  ({ namespaceId, lake, bucketName, prefix, accessKeyId, secretAccessKey, region }) =>
    Effect.gen(function* () {
      p.intro("📁 Create Namespace (AWS S3)");

      const lakeConfig = yield* Effect.try({
        try: () => makeLakeConfig(lake),
        catch: (e) => (e instanceof Error ? e : new Error(String(e))),
      });

      const s = p.spinner();
      s.start("Creating namespace...");

      const namespace = yield* ClusterClient.createNamespace({
        namespaceId,
        objectStore: {
          objectStoreConfig: {
            _tag: "aws",
            aws: {
              bucketName,
              prefix: Option.getOrUndefined(prefix),
              accessKeyId: Redacted.value(accessKeyId),
              secretAccessKey: Redacted.value(secretAccessKey),
              region: Option.getOrUndefined(region),
            },
          },
        },
        lake: lakeConfig,
      }).pipe(Effect.tapError(() => Effect.sync(() => s.stop("Failed to create namespace"))));

      s.stop("Namespace created successfully");
      yield* Effect.sync(() => displayNamespace(namespace));
    }),
).pipe(
  Command.withDescription("Create a namespace backed by AWS S3"),
  Command.provide(({ host, port }) => makeClusterClientLayer(host, port)),
);

// ─── Azure ────────────────────────────────────────────────────────────────────

const createNamespaceAzureCommand = Command.make(
  "azure",
  {
    namespaceId: namespaceIdOption,
    lake: lakeOption,
    containerName: Flag.string("container-name").pipe(
      Flag.withDescription("Azure Blob container name"),
    ),
    prefix: prefixOption,
    storageAccountName: Flag.string("storage-account-name").pipe(
      Flag.withDescription("Azure storage account name"),
    ),
    storageAccountKey: Flag.redacted("storage-account-key").pipe(
      Flag.withDescription("Azure storage account key (or set AZURE_STORAGE_ACCOUNT_KEY env var)"),
      Flag.withFallbackConfig(Config.redacted("AZURE_STORAGE_ACCOUNT_KEY")),
    ),
    host: hostOption,
    port: portOption,
  },
  ({ namespaceId, lake, containerName, prefix, storageAccountName, storageAccountKey }) =>
    Effect.gen(function* () {
      p.intro("📁 Create Namespace (Azure Blob)");

      const lakeConfig = yield* Effect.try({
        try: () => makeLakeConfig(lake),
        catch: (e) => (e instanceof Error ? e : new Error(String(e))),
      });

      const s = p.spinner();
      s.start("Creating namespace...");

      const namespace = yield* ClusterClient.createNamespace({
        namespaceId,
        objectStore: {
          objectStoreConfig: {
            _tag: "azure",
            azure: {
              containerName,
              prefix: Option.getOrUndefined(prefix),
              storageAccountName,
              storageAccountKey: Redacted.value(storageAccountKey),
            },
          },
        },
        lake: lakeConfig,
      }).pipe(Effect.tapError(() => Effect.sync(() => s.stop("Failed to create namespace"))));

      s.stop("Namespace created successfully");
      yield* Effect.sync(() => displayNamespace(namespace));
    }),
).pipe(
  Command.withDescription("Create a namespace backed by Azure Blob Storage"),
  Command.provide(({ host, port }) => makeClusterClientLayer(host, port)),
);

// ─── Google ───────────────────────────────────────────────────────────────────

const createNamespaceGoogleCommand = Command.make(
  "google",
  {
    namespaceId: namespaceIdOption,
    lake: lakeOption,
    bucketName: Flag.string("bucket-name").pipe(Flag.withDescription("GCS bucket name")),
    prefix: prefixOption,
    serviceAccount: Flag.string("service-account").pipe(
      Flag.withDescription("GCP service account email"),
    ),
    serviceAccountKey: Flag.redacted("service-account-key").pipe(
      Flag.withDescription(
        "GCP service account key JSON (or set GOOGLE_SERVICE_ACCOUNT_KEY env var)",
      ),
      Flag.withFallbackConfig(Config.redacted("GOOGLE_SERVICE_ACCOUNT_KEY")),
    ),
    host: hostOption,
    port: portOption,
  },
  ({ namespaceId, lake, bucketName, prefix, serviceAccount, serviceAccountKey }) =>
    Effect.gen(function* () {
      p.intro("📁 Create Namespace (Google Cloud Storage)");

      const lakeConfig = yield* Effect.try({
        try: () => makeLakeConfig(lake),
        catch: (e) => (e instanceof Error ? e : new Error(String(e))),
      });

      const s = p.spinner();
      s.start("Creating namespace...");

      const namespace = yield* ClusterClient.createNamespace({
        namespaceId,
        objectStore: {
          objectStoreConfig: {
            _tag: "google",
            google: {
              bucketName,
              prefix: Option.getOrUndefined(prefix),
              serviceAccount,
              serviceAccountKey: Redacted.value(serviceAccountKey),
            },
          },
        },
        lake: lakeConfig,
      }).pipe(Effect.tapError(() => Effect.sync(() => s.stop("Failed to create namespace"))));

      s.stop("Namespace created successfully");
      yield* Effect.sync(() => displayNamespace(namespace));
    }),
).pipe(
  Command.withDescription("Create a namespace backed by Google Cloud Storage"),
  Command.provide(({ host, port }) => makeClusterClientLayer(host, port)),
);

// ─── S3-Compatible ────────────────────────────────────────────────────────────

const createNamespaceS3Command = Command.make(
  "s3",
  {
    namespaceId: namespaceIdOption,
    lake: lakeOption,
    bucketName: Flag.string("bucket-name").pipe(Flag.withDescription("S3-compatible bucket name")),
    prefix: prefixOption,
    accessKeyId: Flag.redacted("access-key-id").pipe(
      Flag.withDescription("Access key ID (or set S3_ACCESS_KEY_ID env var)"),
      Flag.withFallbackConfig(Config.redacted("S3_ACCESS_KEY_ID")),
    ),
    secretAccessKey: Flag.redacted("secret-access-key").pipe(
      Flag.withDescription("Secret access key (or set S3_SECRET_ACCESS_KEY env var)"),
      Flag.withFallbackConfig(Config.redacted("S3_SECRET_ACCESS_KEY")),
    ),
    endpoint: Flag.string("endpoint").pipe(
      Flag.withDescription("S3-compatible endpoint URL (e.g., http://minio:9000)"),
    ),
    allowHttp: Flag.boolean("allow-http").pipe(
      Flag.withDescription("Allow plain HTTP connections"),
      Flag.withDefault(false),
    ),
    region: Flag.string("region").pipe(Flag.withDescription("Region"), Flag.optional),
    host: hostOption,
    port: portOption,
  },
  ({
    namespaceId,
    lake,
    bucketName,
    prefix,
    accessKeyId,
    secretAccessKey,
    endpoint,
    allowHttp,
    region,
  }) =>
    Effect.gen(function* () {
      p.intro("📁 Create Namespace (S3-Compatible)");

      const lakeConfig = yield* Effect.try({
        try: () => makeLakeConfig(lake),
        catch: (e) => (e instanceof Error ? e : new Error(String(e))),
      });

      const s = p.spinner();
      s.start("Creating namespace...");

      const namespace = yield* ClusterClient.createNamespace({
        namespaceId,
        objectStore: {
          objectStoreConfig: {
            _tag: "s3Compatible",
            s3Compatible: {
              bucketName,
              prefix: Option.getOrUndefined(prefix),
              accessKeyId: Redacted.value(accessKeyId),
              secretAccessKey: Redacted.value(secretAccessKey),
              endpoint,
              allowHttp,
              region: Option.getOrUndefined(region),
            },
          },
        },
        lake: lakeConfig,
      }).pipe(Effect.tapError(() => Effect.sync(() => s.stop("Failed to create namespace"))));

      s.stop("Namespace created successfully");
      yield* Effect.sync(() => displayNamespace(namespace));
    }),
).pipe(
  Command.withDescription("Create a namespace backed by an S3-compatible object store"),
  Command.provide(({ host, port }) => makeClusterClientLayer(host, port)),
);

// ─── Parent command ───────────────────────────────────────────────────────────

export const createNamespaceCommand = Command.make("create-namespace", {}, () => Effect.void).pipe(
  Command.withDescription(
    "Create a new namespace (choose a storage provider as subcommand: aws, azure, google, s3)",
  ),
  Command.withSubcommands([
    createNamespaceAwsCommand,
    createNamespaceAzureCommand,
    createNamespaceGoogleCommand,
    createNamespaceS3Command,
  ]),
);
