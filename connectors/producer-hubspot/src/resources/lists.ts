import { type ConnectorError, Cursor, Fetch, Resource } from "@useairfoil/connector-kit";
import { DateTime, Duration, Effect, Option, Schema, Stream } from "effect";

import { HUBSPOT_API_VERSION, type HubSpotClientService } from "../client/client";
import { type List, type ListObject, ListObjectSchema, ListSchema } from "../schemas/lists";

const searchPath = `/crm/lists/${HUBSPOT_API_VERSION}/search`;
const pageSize = 500;
// Lists have no updated-since filter, so changes read them all.
const changesInterval = Duration.hours(1);

const ListSearchSchema = Schema.Struct({
  lists: Schema.Array(ListObjectSchema),
  offset: Schema.Number,
  hasMore: Schema.Boolean,
});

const search = (client: HubSpotClientService, offset: number, count: number) =>
  client.post(ListSearchSchema, searchPath, {
    offset,
    count,
    processingTypes: [],
    listIds: [],
    additionalProperties: ["hs_list_size"],
  });

const toRow = (list: ListObject, fetchedAt: Date): List => ({
  id: list.listId,
  version: fetchedAt,
  name: list.name,
  object_type_id: list.objectTypeId,
  processing_type: list.processingType,
  processing_status: list.processingStatus,
  size: list.additionalProperties.hs_list_size,
  created_at: list.createdAt,
  updated_at: list.updatedAt,
  filters_updated_at: list.filtersUpdatedAt,
});

// Rows use the fetch time, so each hourly read replaces them.
const listAll = (
  client: HubSpotClientService,
): Effect.Effect<ReadonlyArray<List>, ConnectorError> =>
  Stream.paginate(0, (offset: number) =>
    search(client, offset, pageSize).pipe(
      Effect.map(
        ({ body, fetchedAt }) =>
          [
            body.lists.map((list) => toRow(list, fetchedAt)),
            body.hasMore ? Option.some(body.offset) : Option.none(),
          ] as const,
      ),
    ),
  ).pipe(Stream.runCollect);

export const makeLists = (client: HubSpotClientService) =>
  Resource.entity({
    name: "lists",
    rowSchema: ListSchema,
    version: "version",

    check: search(client, 0, 1).pipe(Effect.asVoid),
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
