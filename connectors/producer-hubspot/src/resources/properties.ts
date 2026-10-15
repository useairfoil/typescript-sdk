import { type ConnectorError, Cursor, Fetch, Resource } from "@useairfoil/connector-kit";
import { DateTime, Duration, Effect } from "effect";

import { HUBSPOT_API_VERSION, type HubSpotClientService } from "../client/client";
import { listPage } from "../schemas/api";
import {
  type Property,
  type PropertyObject,
  PropertyObjectSchema,
  PropertySchema,
} from "../schemas/properties";
import { skipFailedType } from "./object-types";

const PropertyPageSchema = listPage(PropertyObjectSchema);
const changesInterval = Duration.hours(1);

const propertiesPath = (objectType: string) =>
  `/crm/properties/${HUBSPOT_API_VERSION}/${objectType}`;

const toRow = (objectType: string, property: PropertyObject, fetchedAt: Date): Property => ({
  key: `${objectType}:${property.name}`,
  version: fetchedAt,
  object_type: objectType,
  name: property.name,
  label: property.label,
  type: property.type,
  field_type: property.fieldType,
  description: property.description,
  group_name: property.groupName,
  options: property.options.map((option) => ({
    label: option.label,
    value: option.value,
    display_order: option.displayOrder,
    hidden: option.hidden,
  })),
  calculated: property.calculated,
  hidden: property.hidden,
  hubspot_defined: property.hubspotDefined ?? false,
  archived: property.archived ?? false,
  created_at: property.createdAt,
  updated_at: property.updatedAt,
});

// `archived=true` returns only removed properties, so each type takes two calls.
const listParams: ReadonlyArray<Readonly<Record<string, string>>> = [{}, { archived: "true" }];

const listAll = (
  client: HubSpotClientService,
  objectTypes: Effect.Effect<ReadonlyArray<string>, ConnectorError>,
): Effect.Effect<ReadonlyArray<Property>, ConnectorError> =>
  objectTypes.pipe(
    Effect.flatMap((types) =>
      Effect.forEach(types, (objectType) =>
        Effect.forEach(listParams, (params) =>
          client
            .get(PropertyPageSchema, propertiesPath(objectType), params)
            .pipe(
              Effect.map(({ body, fetchedAt }) =>
                body.results.map((property) => toRow(objectType, property, fetchedAt)),
              ),
            ),
        ).pipe(
          Effect.map((lists) => lists.flat()),
          skipFailedType(objectType),
        ),
      ),
    ),
    Effect.map((lists) => lists.flat()),
  );

export const makeProperties = (
  client: HubSpotClientService,
  objectTypes: Effect.Effect<ReadonlyArray<string>, ConnectorError>,
) =>
  Resource.entity({
    name: "properties",
    rowSchema: PropertySchema,
    version: "version",

    // The CRM tables already read their property lists, so one type is enough here.
    check: client.get(PropertyPageSchema, propertiesPath("contacts")).pipe(Effect.asVoid),
    backfill: Fetch.page({
      pageCursor: Cursor.string(),
      cutoff: Cursor.isoDateTime(),
      fetch: () =>
        listAll(client, objectTypes).pipe(Effect.map((rows) => ({ rows, hasMore: false }))),
    }),
    changes: Fetch.changes({
      cursor: Cursor.string(),
      interval: changesInterval,
      fetch: () =>
        Effect.all([listAll(client, objectTypes), DateTime.now]).pipe(
          Effect.map(([rows, now]) => ({ rows, cursor: DateTime.formatIso(now) })),
        ),
    }),
  });
