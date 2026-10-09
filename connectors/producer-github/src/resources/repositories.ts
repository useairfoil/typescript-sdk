import { Cursor, Fetch, Resource } from "@useairfoil/connector-kit";
import { Effect, Option, Schema } from "effect";

import { type GitHubClientService, withParams } from "../client/client";
import {
  RepositoryDeletedEventSchema,
  RepositoryEventSchema,
  WebhookPayloadSchema,
} from "../schemas/events";
import {
  type Repository,
  type RepositoryObject,
  RepositoryObjectSchema,
  RepositorySchema,
} from "../schemas/repositories";
import {
  changesInterval,
  decodeEvent,
  deleteRow,
  installationRepositoriesPath,
  isSince,
  listRepositories,
  pageSize,
  parseCutoff,
  readChanges,
  repositoryPage,
} from "./shared";

const toRow = ({ updated_at, topics, ...rest }: RepositoryObject): Repository => ({
  ...rest,
  version: updated_at,
  topics: topics ?? [],
  _deleted: false,
});

// A webhook can leave a list out. Leave it out of the update too.
const toUpdate = ({ updated_at, topics, ...rest }: RepositoryObject) => ({
  ...rest,
  version: updated_at,
  ...(topics === undefined ? {} : { topics }),
  _deleted: false,
});

export const makeRepositories = (client: GitHubClientService) =>
  Resource.entity({
    name: "repositories",
    rowSchema: RepositorySchema,
    key: "id",
    version: "version",

    check: client
      .get(
        repositoryPage(RepositoryObjectSchema),
        withParams(installationRepositoriesPath, { per_page: "1" }),
      )
      .pipe(Effect.asVoid),
    // The installation's list can't filter on time, so the cutoff is applied here.
    backfill: Fetch.page({
      pageCursor: Cursor.string(),
      cutoff: Cursor.isoDateTime(),
      fetch: ({ pageCursor, cutoff }) =>
        Effect.gen(function* () {
          const cutoffDate = parseCutoff(String(cutoff));
          const page = yield* client.get(
            repositoryPage(RepositoryObjectSchema),
            typeof pageCursor === "string"
              ? pageCursor
              : withParams(installationRepositoriesPath, { per_page: pageSize }),
          );
          return {
            rows: page.body.repositories
              .filter((repository) => repository.created_at.getTime() <= cutoffDate.getTime())
              .map(toRow),
            nextPageCursor: Option.getOrUndefined(page.next),
            hasMore: Option.isSome(page.next),
          };
        }),
    }),
    // New repositories are kept too, so one added later still gets a row.
    changes: Fetch.changes({
      cursor: Cursor.string(),
      interval: changesInterval,
      fetch: ({ cursor }) =>
        readChanges(
          String(cursor),
          listRepositories(client, RepositoryObjectSchema),
          (repositories) =>
            repositories
              .filter(({ repository, since }) => isSince(since, repository.updated_at))
              .map(({ repository }) => toRow(repository)),
        ),
    }),
    webhook: {
      schema: WebhookPayloadSchema,
      handler: ({ payload }) =>
        Effect.gen(function* () {
          const event = yield* decodeEvent(RepositoryEventSchema, payload);
          if (Schema.is(RepositoryDeletedEventSchema)(event)) {
            return [yield* deleteRow(event.repository.id)];
          }
          return [toUpdate(event.repository)];
        }),
    },
  });
