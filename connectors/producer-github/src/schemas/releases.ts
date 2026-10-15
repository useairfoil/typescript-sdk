import { Iceberg } from "@useairfoil/connector-kit";
import { Schema, Struct } from "effect";

import { Long, Text, Timestamp, deleted, field, list, user, version } from "./shared";

const asset = (baseId: number) =>
  Schema.Struct({
    id: Long.pipe(field(baseId, "Asset ID.")),
    name: Schema.String.pipe(field(baseId + 1, "File name.")),
    label: Schema.NullOr(Schema.String).pipe(field(baseId + 2, "Label shown instead of the name.")),
    state: Schema.String.pipe(field(baseId + 3, "State: uploaded or open.")),
    content_type: Schema.String.pipe(field(baseId + 4, "Media type of the file.")),
    size: Long.pipe(field(baseId + 5, "Size in bytes.")),
    download_count: Long.pipe(
      field(baseId + 6, "Number of downloads when the release last changed."),
    ),
    created_at: Timestamp.pipe(field(baseId + 7, "Time the asset was uploaded.")),
    updated_at: Timestamp.pipe(field(baseId + 8, "Time the asset last changed.")),
    browser_download_url: Schema.String.pipe(field(baseId + 9, "Download link.")),
  });

export const ReleaseSchema = Schema.Struct({
  id: Long.pipe(field(1, "Unique release ID.")),
  version: version(2, "release"),
  node_id: Schema.String.pipe(field(3, "GraphQL node ID of the release.")),
  repository_id: Long.pipe(field(4, "ID of the repository the release belongs to.")),
  tag_name: Schema.String.pipe(field(5, "Tag of the release.")),
  target_commitish: Schema.String.pipe(field(6, "Branch or commit the tag was created from.")),
  name: Text.pipe(field(7, "Release title. Empty when not set.")),
  body: Text.pipe(field(8, "Release notes in Markdown. Empty when not set.")),
  draft: Schema.Boolean.pipe(field(9, "Whether the release is a draft.")),
  prerelease: Schema.Boolean.pipe(field(10, "Whether the release is a pre-release.")),
  author: user(100).pipe(field(11, "Account that created the release.")),
  assets: list(103, asset(104)).pipe(field(12, "Files attached to the release.")),
  created_at: Timestamp.pipe(field(13, "Time the release was created.")),
  published_at: Schema.NullOr(Timestamp).pipe(field(14, "Time the release was published.")),
  html_url: Schema.String.pipe(field(15, "Release page on GitHub.")),
  _deleted: deleted(16, "release"),
})
  .annotate({
    description: "Releases in the installation's repositories, with their assets.",
  })
  .pipe(Iceberg.identifier("id"));

export type Release = Schema.Schema.Type<typeof ReleaseSchema>;

export const ReleaseObjectSchema = ReleaseSchema.mapFields((fields) => ({
  ...Struct.omit(fields, ["version", "repository_id", "_deleted"]),
  // Not always set, according to the API schema.
  updated_at: Schema.optionalKey(Schema.NullOr(Timestamp)),
}));

export type ReleaseObject = Schema.Schema.Type<typeof ReleaseObjectSchema>;
