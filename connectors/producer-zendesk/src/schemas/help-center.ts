import { Iceberg } from "@useairfoil/connector-kit";
import { Schema, Struct } from "effect";

import { Long, Timestamp, field, list, version } from "./shared";

const common = (object: string) => ({
  id: Long.pipe(field(1, `${object} ID.`)),
  version: version(2, object.toLowerCase()),
  created_at: Timestamp.pipe(field(3, `Time the ${object.toLowerCase()} was created.`)),
  updated_at: Timestamp.pipe(field(4, `Time the ${object.toLowerCase()} was last updated.`)),
  html_url: Schema.String.pipe(field(5, `Web address of the ${object.toLowerCase()}.`)),
});

export const ArticleSchema = Schema.Struct({
  ...common("Article"),
  title: Schema.String.pipe(field(6, "Article title.")),
  body: Schema.NullOr(Schema.String).pipe(field(7, "Article body, as HTML.")),
  locale: Schema.String.pipe(field(8, "Locale of this version, such as en-us.")),
  source_locale: Schema.String.pipe(field(9, "Locale the article was written in.")),
  section_id: Long.pipe(field(10, "Section the article is in.")),
  author_id: Long.pipe(field(11, "User who wrote the article.")),
  draft: Schema.Boolean.pipe(field(12, "Whether the article is a draft.")),
  promoted: Schema.Boolean.pipe(field(13, "Whether the article is promoted.")),
  position: Long.pipe(field(14, "Position in its section.")),
  vote_sum: Long.pipe(field(15, "Up votes minus down votes.")),
  vote_count: Long.pipe(field(16, "Number of votes.")),
  label_names: list(101, Schema.String).pipe(field(17, "Labels.")),
  edited_at: Timestamp.pipe(field(18, "Time the text was last edited.")),
})
  .annotate({ description: "Zendesk Help Center articles." })
  .pipe(Iceberg.identifier("id"));

export const SectionSchema = Schema.Struct({
  ...common("Section"),
  name: Schema.String.pipe(field(6, "Section name.")),
  description: Schema.NullOr(Schema.String).pipe(field(7, "Section description.")),
  locale: Schema.String.pipe(field(8, "Locale, such as en-us.")),
  category_id: Long.pipe(field(9, "Category the section is in.")),
  parent_section_id: Schema.NullOr(Long).pipe(field(10, "Parent section, if nested.")),
  position: Long.pipe(field(11, "Position in its category.")),
})
  .annotate({ description: "Zendesk Help Center sections." })
  .pipe(Iceberg.identifier("id"));

export const CategorySchema = Schema.Struct({
  ...common("Category"),
  name: Schema.String.pipe(field(6, "Category name.")),
  description: Schema.NullOr(Schema.String).pipe(field(7, "Category description.")),
  locale: Schema.String.pipe(field(8, "Locale, such as en-us.")),
  position: Long.pipe(field(9, "Position in the Help Center.")),
})
  .annotate({ description: "Zendesk Help Center categories." })
  .pipe(Iceberg.identifier("id"));

export const CommunityPostSchema = Schema.Struct({
  ...common("Post"),
  title: Schema.String.pipe(field(6, "Post title.")),
  details: Schema.NullOr(Schema.String).pipe(field(7, "Post text, as HTML.")),
  author_id: Long.pipe(field(8, "User who wrote the post.")),
  topic_id: Long.pipe(field(9, "Topic the post is in.")),
  status: Schema.String.pipe(field(10, "none, planned, not_planned, completed, or answered.")),
  featured: Schema.Boolean.pipe(field(11, "Whether the post is featured.")),
  pinned: Schema.Boolean.pipe(field(12, "Whether the post is pinned.")),
  closed: Schema.Boolean.pipe(field(13, "Whether the post is closed for comments.")),
  vote_sum: Long.pipe(field(14, "Up votes minus down votes.")),
  vote_count: Long.pipe(field(15, "Number of votes.")),
  comment_count: Long.pipe(field(16, "Number of comments.")),
  follower_count: Long.pipe(field(17, "Number of followers.")),
})
  .annotate({ description: "Posts in the Zendesk community." })
  .pipe(Iceberg.identifier("id"));

export const CommunityTopicSchema = Schema.Struct({
  ...common("Topic"),
  name: Schema.String.pipe(field(6, "Topic name.")),
  description: Schema.NullOr(Schema.String).pipe(field(7, "Topic description.")),
  position: Long.pipe(field(8, "Position in the community.")),
  follower_count: Long.pipe(field(9, "Number of followers.")),
})
  .annotate({ description: "Topics in the Zendesk community." })
  .pipe(Iceberg.identifier("id"));

export type Article = Schema.Schema.Type<typeof ArticleSchema>;
export type Section = Schema.Schema.Type<typeof SectionSchema>;
export type Category = Schema.Schema.Type<typeof CategorySchema>;
export type CommunityPost = Schema.Schema.Type<typeof CommunityPostSchema>;
export type CommunityTopic = Schema.Schema.Type<typeof CommunityTopicSchema>;

const objectOf = <F extends Schema.Struct.Fields>(schema: Schema.Struct<F>) =>
  schema.mapFields((fields) => Struct.omit(fields, ["version"]));

export const ArticleObjectSchema = objectOf(ArticleSchema);
export const SectionObjectSchema = objectOf(SectionSchema);
export const CategoryObjectSchema = objectOf(CategorySchema);
export const CommunityPostObjectSchema = objectOf(CommunityPostSchema);
export const CommunityTopicObjectSchema = objectOf(CommunityTopicSchema);
