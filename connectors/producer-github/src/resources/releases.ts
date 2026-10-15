import { type ConnectorError, Resource } from "@useairfoil/connector-kit";
import { Effect, Schema, Struct } from "effect";

import type { GitHubClientService } from "../client/client";
import type { RepositoryRef } from "../schemas/repositories";

import {
  ReleaseDeletedEventSchema,
  ReleaseEventSchema,
  WebhookPayloadSchema,
} from "../schemas/events";
import {
  type Release,
  type ReleaseObject,
  ReleaseObjectSchema,
  ReleaseSchema,
} from "../schemas/releases";
import {
  type RepoResourceSpec,
  backfillRepoResource,
  changesRepoResource,
  checkRepoResource,
  decodeEvent,
  deleteRow,
  rowsOf,
} from "./shared";

const updatedAt = (release: ReleaseObject) => release.updated_at ?? release.created_at;

const toRow = (release: ReleaseObject, repository_id: bigint): Release => ({
  ...Struct.omit(release, ["updated_at"]),
  version: updatedAt(release),
  repository_id,
});

export const releaseSpec: RepoResourceSpec<ReleaseObject, Release> = {
  path: "releases",
  pageSchema: Schema.Array(ReleaseObjectSchema),
  params: {},
  since: false,
  // The list can't sort or filter, so changes read it all. Most repositories
  // have few releases.
  order: "newest",
  createdAt: (release) => release.created_at,
  updatedAt,
  keep: () => true,
  enabled: () => true,
  rows: rowsOf(toRow),
};

export const makeReleases = (
  client: GitHubClientService,
  repositories: Effect.Effect<ReadonlyArray<RepositoryRef>, ConnectorError>,
) =>
  Resource.entity({
    name: "releases",
    rowSchema: ReleaseSchema,
    version: "version",

    check: checkRepoResource(client, releaseSpec),
    backfill: backfillRepoResource(client, repositories, releaseSpec),
    changes: changesRepoResource(client, releaseSpec),
    webhook: {
      schema: WebhookPayloadSchema,
      handler: ({ payload }) =>
        Effect.gen(function* () {
          const event = yield* decodeEvent(ReleaseEventSchema, payload);
          if (Schema.is(ReleaseDeletedEventSchema)(event)) {
            return [yield* deleteRow(event.release.id)];
          }
          return [toRow(event.release, event.repository.id)];
        }),
    },
  });
