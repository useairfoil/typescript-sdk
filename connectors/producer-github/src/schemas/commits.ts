import { Iceberg } from "@useairfoil/connector-kit";
import { Schema, SchemaTransformation } from "effect";

import { Long, Timestamp, field, list, user } from "./shared";

export const gitActor = (baseId: number) =>
  Schema.Struct({
    name: Schema.String.pipe(field(baseId, "Name in the commit.")),
    date: Timestamp.pipe(field(baseId + 1, "Time in the commit.")),
  });

/**
 * The GitHub account of a commit's author or committer. GitHub sends `null` or
 * `{}` when the email matches no account, and both become `null`.
 */
export const account = (baseId: number) =>
  Schema.NullOr(Schema.Union([user(baseId), Schema.Struct({})])).pipe(
    Schema.decodeTo(
      Schema.NullOr(Schema.toType(user(baseId))),
      SchemaTransformation.transform({
        decode: (value) => (value !== null && "id" in value ? value : null),
        encode: (value) => value,
      }),
    ),
  );

export const CommitSchema = Schema.Struct({
  key: Schema.String.pipe(field(1, "Repository ID and SHA, such as `1406396726:9eb3a7d`.")),
  version: Schema.Date.pipe(field(2, "Commit time. A commit never changes.")),
  repository_id: Long.pipe(field(3, "ID of the repository the commit is in.")),
  sha: Schema.String.pipe(field(4, "Commit SHA.")),
  node_id: Schema.String.pipe(field(5, "GraphQL node ID of the commit.")),
  message: Schema.String.pipe(field(6, "Commit message.")),
  author: gitActor(100).pipe(field(7, "Author name and time from the commit.")),
  committer: gitActor(102).pipe(field(8, "Committer name and time from the commit.")),
  author_user: account(104).pipe(field(9, "GitHub account of the author.")),
  committer_user: account(107).pipe(field(10, "GitHub account of the committer.")),
  parents: list(110, Schema.String).pipe(field(11, "SHAs of the parent commits.")),
  verified: Schema.Boolean.pipe(field(12, "Whether GitHub verified the commit signature.")),
  html_url: Schema.String.pipe(field(13, "Commit page on GitHub.")),
})
  .annotate({
    description: "Commits on the default branch of the installation's repositories.",
  })
  .pipe(Iceberg.identifier("key"));

export type Commit = Schema.Schema.Type<typeof CommitSchema>;

export const CommitObjectSchema = Schema.Struct({
  sha: Schema.String,
  node_id: Schema.String,
  commit: Schema.Struct({
    author: gitActor(100),
    committer: gitActor(102),
    message: Schema.String,
    verification: Schema.optionalKey(Schema.Struct({ verified: Schema.Boolean })),
  }),
  author: account(104),
  committer: account(107),
  parents: Schema.Array(Schema.Struct({ sha: Schema.String })),
  html_url: Schema.String,
});

export type CommitObject = Schema.Schema.Type<typeof CommitObjectSchema>;
