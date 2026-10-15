import { ConnectorError } from "@useairfoil/connector-kit";
import { Array as Arr, Effect, Order, Schema } from "effect";

import type { SalesforceClientService } from "../client/client";
import type { ObjectRow } from "../schemas/objects";
import type { Describer } from "./describe";

import { RecordListSchema, type SalesforceRecord, RecordTimesSchema } from "../schemas/api";

// The most IDs one collections read takes.
export const readBatchSize = 2_000;

/** Every non-null value as a string, by name. Text stays as Salesforce sends it. */
const toFields = (record: SalesforceRecord): ReadonlyMap<string, string> =>
  new Map(
    Arr.sortWith(
      Object.entries(record).flatMap(
        ([name, value]): ReadonlyArray<[string, string]> =>
          typeof value === "string"
            ? [[name, value]]
            : typeof value === "number" || typeof value === "boolean"
              ? [[name, String(value)]]
              : [],
      ),
      ([name]) => name,
      Order.String,
    ),
  );

const toRow = (record: SalesforceRecord, fetchedAt: Date) =>
  Schema.decodeUnknownEffect(RecordTimesSchema)(record).pipe(
    Effect.mapError(
      (cause) =>
        new ConnectorError({ message: `Invalid Salesforce times on record ${record.Id}`, cause }),
    ),
    Effect.map(
      (times): ObjectRow => ({
        id: record.Id,
        version: fetchedAt,
        created_at: times.CreatedDate ?? null,
        updated_at: times.SystemModstamp ?? null,
        fields: toFields(record),
        _deleted: false,
      }),
    ),
  );

/**
 * Reads full rows. IDs that are deleted, merged away, or hidden from the
 * connector's user are left out.
 */
export const readRows = (
  client: SalesforceClientService,
  describer: Describer,
  object: string,
  ids: ReadonlyArray<string>,
): Effect.Effect<ReadonlyArray<ObjectRow>, ConnectorError> =>
  Effect.gen(function* () {
    if (ids.length === 0) return [];
    const { fieldNames } = yield* describer.describe(object);
    const batches = yield* Effect.forEach(Arr.chunksOf(ids, readBatchSize), (chunk) =>
      client.post(RecordListSchema, `/composite/sobjects/${object}`, {
        ids: chunk,
        fields: fieldNames,
      }),
    );
    return yield* Effect.forEach(
      batches.flatMap(({ body, fetchedAt }) =>
        body.flatMap((record) => (record === null ? [] : [{ record, fetchedAt }])),
      ),
      ({ record, fetchedAt }) => toRow(record, fetchedAt),
    );
  }).pipe(
    // A field removed since the describe fails the read, so describe again and
    // retry once. A failed source stays stopped until restart.
    Effect.tapError(() => describer.invalidate(object)),
    Effect.retry({ times: 1 }),
  );
