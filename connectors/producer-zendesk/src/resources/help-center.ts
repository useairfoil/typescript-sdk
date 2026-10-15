import { Resource } from "@useairfoil/connector-kit";
import { Effect, Schema, SchemaTransformation, Struct } from "effect";

import type { ZendeskClientService } from "../client/client";

import {
  ArticleObjectSchema,
  ArticleSchema,
  CategoryObjectSchema,
  CategorySchema,
  CommunityPostObjectSchema,
  CommunityPostSchema,
  CommunityTopicObjectSchema,
  CommunityTopicSchema,
  SectionObjectSchema,
  SectionSchema,
} from "../schemas/help-center";
import { timeExport } from "./exports";
import { listAll, listSources } from "./pages";

const ArticlePage = {
  articles: Schema.Array(ArticleObjectSchema),
  end_time: Schema.NullOr(Schema.Number),
};

// This export has no `end_of_stream`, so the last page is the one with no
// `next_page`. An empty page says `end_time` is 1, so we drop it and keep the
// start time.
const ArticlePageSchema = Schema.Struct({
  ...ArticlePage,
  next_page: Schema.NullOr(Schema.String),
}).pipe(
  Schema.decodeTo(
    Schema.toType(Schema.Struct({ ...ArticlePage, end_of_stream: Schema.Boolean })),
    SchemaTransformation.transform({
      decode: ({ next_page, ...page }) => ({
        ...page,
        end_time: page.articles.length === 0 ? null : page.end_time,
        end_of_stream: next_page === null,
      }),
      encode: (page) => ({ ...Struct.omit(page, ["end_of_stream"]), next_page: null }),
    }),
  ),
);

export const makeArticles = (client: ZendeskClientService) =>
  Resource.entity({
    name: "articles",
    rowSchema: ArticleSchema,
    version: "version",
    ...timeExport({
      client,
      path: "/help_center/incremental/articles",
      schema: ArticlePageSchema,
      rows: (page) =>
        Effect.succeed(
          page.articles.map((article) => ({ ...article, version: article.updated_at })),
        ),
    }),
  });

export const makeSections = (client: ZendeskClientService) =>
  Resource.entity({
    name: "sections",
    rowSchema: SectionSchema,
    version: "version",
    ...listSources(
      listAll(client, {
        path: "/help_center/sections",
        key: "sections",
        item: SectionObjectSchema,
      }).pipe(
        Effect.map((sections) =>
          sections.map((section) => ({ ...section, version: section.updated_at })),
        ),
      ),
    ),
  });

export const makeCategories = (client: ZendeskClientService) =>
  Resource.entity({
    name: "categories",
    rowSchema: CategorySchema,
    version: "version",
    ...listSources(
      listAll(client, {
        path: "/help_center/categories",
        key: "categories",
        item: CategoryObjectSchema,
      }).pipe(
        Effect.map((categories) =>
          categories.map((category) => ({ ...category, version: category.updated_at })),
        ),
      ),
    ),
  });

export const makeCommunityPosts = (client: ZendeskClientService) =>
  Resource.entity({
    name: "community_posts",
    rowSchema: CommunityPostSchema,
    version: "version",
    ...listSources(
      listAll(client, {
        path: "/community/posts",
        key: "posts",
        item: CommunityPostObjectSchema,
      }).pipe(Effect.map((posts) => posts.map((post) => ({ ...post, version: post.updated_at })))),
    ),
  });

export const makeCommunityTopics = (client: ZendeskClientService) =>
  Resource.entity({
    name: "community_topics",
    rowSchema: CommunityTopicSchema,
    version: "version",
    ...listSources(
      listAll(client, {
        path: "/community/topics",
        key: "topics",
        item: CommunityTopicObjectSchema,
      }).pipe(
        Effect.map((topics) => topics.map((topic) => ({ ...topic, version: topic.updated_at }))),
      ),
    ),
  });
