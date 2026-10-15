import { type ConnectorError, Cursor, Fetch, Resource } from "@useairfoil/connector-kit";
import { DateTime, Duration, Effect } from "effect";

import type { DescribeField } from "../schemas/api";
import type { Describer } from "./describe";

import { objects } from "../manifest";
import { type ObjectField, ObjectFieldSchema } from "../schemas/object-fields";
import { customObjectNames } from "./custom-objects";

const changesInterval = Duration.hours(1);

const toRow = (object: string, field: DescribeField, version: Date): ObjectField => ({
  id: `${object}.${field.name}`,
  version,
  object,
  name: field.name,
  label: field.label,
  type: field.type,
  custom: field.custom,
  calculated: field.calculated,
  nillable: field.nillable,
  length: BigInt(field.length),
  precision: BigInt(field.precision),
  scale: BigInt(field.scale),
  reference_to: field.referenceTo,
  picklist_values: field.picklistValues,
});

/** Standard objects in the connector's list that the org has, then custom objects. */
const syncedObjects = (describer: Describer) =>
  Effect.all([describer.objects, customObjectNames(describer)]).pipe(
    Effect.map(([all, custom]) => {
      const names = new Set(all.map((object) => object.name));
      return [...objects.map((spec) => spec.object).filter((name) => names.has(name)), ...custom];
    }),
  );

const listAll = (describer: Describer): Effect.Effect<ReadonlyArray<ObjectField>, ConnectorError> =>
  Effect.gen(function* () {
    const version = yield* DateTime.nowAsDate;
    const lists = yield* Effect.forEach(yield* syncedObjects(describer), (object) =>
      describer.describe(object).pipe(
        Effect.map((info) => info.fields.map((field) => toRow(object, field, version))),
        // Its own table shows the error, and its old rows stay.
        Effect.catch((error) =>
          Effect.logWarning("Skipped Salesforce object").pipe(
            Effect.annotateLogs({ object, error: error.message }),
            Effect.as([]),
          ),
        ),
      ),
    );
    return lists.flat();
  });

export const makeObjectFields = (describer: Describer) =>
  Resource.entity({
    name: "object_fields",
    rowSchema: ObjectFieldSchema,
    version: "version",

    check: describer.objects.pipe(Effect.asVoid),
    backfill: Fetch.page({
      pageCursor: Cursor.string(),
      cutoff: Cursor.isoDateTime(),
      fetch: () => listAll(describer).pipe(Effect.map((rows) => ({ rows, hasMore: false }))),
    }),
    changes: Fetch.changes({
      cursor: Cursor.string(),
      interval: changesInterval,
      fetch: () =>
        Effect.all([listAll(describer), DateTime.now]).pipe(
          Effect.map(([rows, now]) => ({ rows, cursor: DateTime.formatIso(now) })),
        ),
    }),
  });
