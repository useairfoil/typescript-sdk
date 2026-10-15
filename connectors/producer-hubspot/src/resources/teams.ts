import { type ConnectorError, Cursor, Fetch, Resource } from "@useairfoil/connector-kit";
import { DateTime, Duration, Effect, Option, Stream } from "effect";

import { HUBSPOT_API_VERSION, type HubSpotClientService } from "../client/client";
import { listPage } from "../schemas/api";
import { type Team, TeamMemberObjectSchema, TeamObjectSchema, TeamSchema } from "../schemas/teams";

const teamsPath = `/settings/teams/${HUBSPOT_API_VERSION}`;
const TeamPageSchema = listPage(TeamObjectSchema);
const MemberPageSchema = listPage(TeamMemberObjectSchema);
// Teams are few and have no updated-since filter, so changes read them all.
const changesInterval = Duration.hours(1);

const afterParam = (after: Option.Option<string>) =>
  Option.match(after, { onNone: () => ({}), onSome: (value) => ({ after: value }) });

const members = (client: HubSpotClientService, teamId: string) =>
  Stream.paginate(Option.none<string>(), (after) =>
    client
      .get(MemberPageSchema, `${teamsPath}/${teamId}/members`, {
        limit: "100",
        ...afterParam(after),
      })
      .pipe(
        Effect.map(
          ({ body }) =>
            [
              body.results.map((member) => ({ user_id: member.userId, type: member.type })),
              Option.map(Option.fromNullishOr(body.paging?.next.after), Option.some),
            ] as const,
        ),
      ),
  ).pipe(Stream.runCollect);

// Rows use the fetch time, so each hourly read replaces them.
const listAll = (
  client: HubSpotClientService,
): Effect.Effect<ReadonlyArray<Team>, ConnectorError> =>
  Stream.paginate(Option.none<string>(), (after) =>
    client
      .get(TeamPageSchema, teamsPath, { limit: "100", ...afterParam(after) })
      .pipe(
        Effect.map(
          ({ body, fetchedAt }) =>
            [
              body.results.map((team) => ({ team, fetchedAt })),
              Option.map(Option.fromNullishOr(body.paging?.next.after), Option.some),
            ] as const,
        ),
      ),
  ).pipe(
    Stream.mapEffect(({ team, fetchedAt }) =>
      members(client, team.id).pipe(
        Effect.map(
          (list): Team => ({
            id: team.id,
            version: fetchedAt,
            name: team.name,
            ...(team.parentTeamId == null ? {} : { parent_team_id: team.parentTeamId }),
            members: list,
          }),
        ),
      ),
    ),
    Stream.runCollect,
  );

export const makeTeams = (client: HubSpotClientService) =>
  Resource.entity({
    name: "teams",
    rowSchema: TeamSchema,
    version: "version",

    check: client.get(TeamPageSchema, teamsPath, { limit: "1" }).pipe(Effect.asVoid),
    backfill: Fetch.page({
      pageCursor: Cursor.string(),
      cutoff: Cursor.isoDateTime(),
      fetch: () => listAll(client).pipe(Effect.map((rows) => ({ rows, hasMore: false }))),
    }),
    changes: Fetch.changes({
      cursor: Cursor.string(),
      interval: changesInterval,
      fetch: () =>
        Effect.all([listAll(client), DateTime.now]).pipe(
          Effect.map(([rows, now]) => ({ rows, cursor: DateTime.formatIso(now) })),
        ),
    }),
  });
