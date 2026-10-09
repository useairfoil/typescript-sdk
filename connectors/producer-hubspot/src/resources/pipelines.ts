import { type ConnectorError, Cursor, Fetch, Resource } from "@useairfoil/connector-kit";
import { DateTime, Duration, Effect, Schema } from "effect";

import { HUBSPOT_API_VERSION, type HubSpotClientService } from "../client/client";
import {
  type Pipeline,
  type PipelineObject,
  PipelineObjectSchema,
  PipelineSchema,
} from "../schemas/pipelines";

const objectTypes = ["deals", "tickets"] as const;
const PipelineListSchema = Schema.Struct({ results: Schema.Array(PipelineObjectSchema) });
const changesInterval = Duration.hours(1);

const pipelinesPath = (objectType: string) => `/crm/pipelines/${HUBSPOT_API_VERSION}/${objectType}`;

const toRow = (objectType: string, pipeline: PipelineObject, fetchedAt: Date): Pipeline => ({
  key: `${objectType}:${pipeline.id}`,
  version: fetchedAt,
  object_type: objectType,
  id: pipeline.id,
  label: pipeline.label,
  display_order: pipeline.displayOrder,
  archived: pipeline.archived,
  stages: pipeline.stages.map((stage) => ({
    id: stage.id,
    label: stage.label,
    display_order: stage.displayOrder,
    archived: stage.archived,
    metadata: stage.metadata,
  })),
  created_at: pipeline.createdAt,
});

// `archived=true` also returns active pipelines, so one call gets them all.
const listAll = (
  client: HubSpotClientService,
): Effect.Effect<ReadonlyArray<Pipeline>, ConnectorError> =>
  Effect.forEach(objectTypes, (objectType) =>
    client
      .get(PipelineListSchema, pipelinesPath(objectType), { archived: "true" })
      .pipe(
        Effect.map(({ body, fetchedAt }) =>
          body.results.map((pipeline) => toRow(objectType, pipeline, fetchedAt)),
        ),
      ),
  ).pipe(Effect.map((lists) => lists.flat()));

export const makePipelines = (client: HubSpotClientService) =>
  Resource.entity({
    name: "pipelines",
    rowSchema: PipelineSchema,
    key: "key",
    version: "version",

    check: Effect.forEach(
      objectTypes,
      (objectType) => client.get(PipelineListSchema, pipelinesPath(objectType)),
      { discard: true },
    ),
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
