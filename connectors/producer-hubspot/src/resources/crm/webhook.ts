import type { ConnectorError } from "@useairfoil/connector-kit";

import { Array as Arr, DateTime, Effect, Schema } from "effect";

import type { CrmReader } from "./read";
import type { CrmSpec, DeleteRow } from "./spec";

/**
 * What the webhook route asks of one resource: a record was deleted, or
 * changed and needs reading. `linkedTo` is the other object type of an
 * association change.
 */
export const RecordEventsSchema = Schema.Array(
  Schema.Struct({
    id: Schema.String,
    deleted: Schema.Boolean,
    linkedTo: Schema.optional(Schema.String),
  }),
);

export type RecordEvents = Schema.Schema.Type<typeof RecordEventsSchema>;

/**
 * Every record is read again. A delete is sent only when the record no longer
 * reads, so a late delete can't hide a restore. Deletes use the arrival time,
 * the same clock as reads. A table only reads association changes for links it
 * stores.
 */
export const crmWebhook = <Row extends object>(reader: CrmReader<Row>, spec: CrmSpec<Row>) => ({
  schema: RecordEventsSchema,
  handler: ({
    payload,
  }: {
    readonly payload: RecordEvents;
  }): Effect.Effect<ReadonlyArray<Row | DeleteRow>, ConnectorError> =>
    Effect.gen(function* () {
      const stored = new Set(spec.associations.map((association) => association.typeId));
      const events = payload.filter(
        (event) => event.linkedTo === undefined || stored.has(event.linkedTo),
      );
      const now = yield* DateTime.nowAsDate;
      const read = yield* reader.read(events.map((event) => event.id));
      const deletes = Arr.dedupe(
        events.filter((event) => event.deleted && !read.ids.has(event.id)).map((event) => event.id),
      ).map((id): DeleteRow => ({ id, version: now, _deleted: true }));
      const deletedIds = new Set(deletes.map((row) => row.id));
      return [...read.rows, ...read.merged.filter((row) => !deletedIds.has(row.id)), ...deletes];
    }),
});
