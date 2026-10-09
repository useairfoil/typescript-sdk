import { Schema, Struct } from "effect";

import { Long, Text, Timestamp, deleted, field, list, optionalList, user, version } from "./shared";

export const RepositorySchema = Schema.Struct({
  id: Long.pipe(field(1, "Unique repository ID.")),
  version: version(2, "repository"),
  node_id: Schema.String.pipe(field(3, "GraphQL node ID of the repository.")),
  name: Schema.String.pipe(field(4, "Repository name.")),
  full_name: Schema.String.pipe(field(5, "Owner and name, such as octo-org/octo-repo.")),
  owner: user(100).pipe(field(6, "Account that owns the repository.")),
  private: Schema.Boolean.pipe(field(7, "Whether the repository is private.")),
  visibility: Schema.optionalKey(Schema.String).pipe(
    field(8, "Visibility: public, private, or internal."),
  ),
  description: Text.pipe(field(9, "Repository description. Empty when not set.")),
  fork: Schema.Boolean.pipe(field(10, "Whether the repository is a fork.")),
  archived: Schema.Boolean.pipe(field(11, "Whether the repository is archived.")),
  disabled: Schema.Boolean.pipe(field(12, "Whether the repository is disabled.")),
  default_branch: Schema.String.pipe(field(13, "Default branch name.")),
  language: Schema.NullOr(Schema.String).pipe(field(14, "Main language GitHub detected.")),
  topics: list(103, Schema.String).pipe(field(15, "Repository topics.")),
  html_url: Schema.String.pipe(field(16, "Repository page on GitHub.")),
  created_at: Timestamp.pipe(field(17, "Time the repository was created.")),
  _deleted: deleted(18, "repository"),
}).annotate({
  description: "Repositories the GitHub App installation can read.",
});

export type Repository = Schema.Schema.Type<typeof RepositorySchema>;

export const RepositoryObjectSchema = RepositorySchema.mapFields((fields) => ({
  ...Struct.omit(fields, ["version", "topics", "_deleted"]),
  updated_at: Timestamp,
  topics: optionalList(Schema.String),
}));

export type RepositoryObject = Schema.Schema.Type<typeof RepositoryObjectSchema>;

export const RepositoryRefSchema = Schema.Struct({
  id: Schema.Number,
  full_name: Schema.String,
  archived: Schema.Boolean,
  updated_at: Timestamp,
  has_issues: Schema.Boolean,
  has_pull_requests: Schema.optionalKey(Schema.Boolean),
});

export type RepositoryRef = Schema.Schema.Type<typeof RepositoryRefSchema>;
