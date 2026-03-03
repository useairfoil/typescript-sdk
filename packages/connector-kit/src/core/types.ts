import type { Effect, Queue, Schema, Stream } from "effect";
import type { ConnectorError } from "./errors";

export type Cursor = string | number | bigint | Date;

export type Batch<T> = {
  readonly cursor: Cursor;
  readonly rows: ReadonlyArray<T>;
};

export type StreamState<C = Cursor> = {
  readonly cutoff: C;
  readonly current?: C;
};

export type IngestionState<C = Cursor> = {
  readonly backfill: StreamState<C>;
  readonly live: StreamState<C>;
};

export type Transform<T> = (row: T) => Effect.Effect<T, ConnectorError>;

export type LiveStream<T> = Stream.Stream<Batch<T>, ConnectorError>;

export type BackfillStream<T> = Stream.Stream<Batch<T>, ConnectorError>;

export type WebhookStream<T> = {
  /**
   * The queue is used to store the batches that are received from the webhook.
   */
  readonly queue: Queue.Queue<Batch<T>>;
  /**
   * The stream is used to process the batches that are received from the webhook.
   */
  readonly stream: Stream.Stream<Batch<T>, ConnectorError>;
};

export type LiveSource<T> = LiveStream<T> | WebhookStream<T>;

/** Schema type used by connector definitions. */
export type EntitySchema = Schema.Schema.Any;
/** Decoded row type produced by a schema. */
export type EntityType<S extends EntitySchema> = Schema.Schema.Type<S>;
/** Primary key type derived from the decoded schema shape. */
export type EntityKey<S extends EntitySchema> =
  EntityType<S> extends Record<string, unknown>
    ? keyof EntityType<S> & string
    : never;
/** Row type constrained to object-like shapes for ingestion. */
export type EntityRow<S extends EntitySchema> = EntityType<S> &
  Record<string, unknown>;

export type EntityDefinition<S extends EntitySchema> = {
  readonly name: string;
  readonly schema: S;
  /**
   * The primary key is used to identify the rows in the database.
   */
  readonly primaryKey: EntityKey<S>;
  /**
   * The live source is used to stream the live data from the database.
   */
  readonly live: LiveSource<EntityRow<S>>;
  /**
   * The backfill stream is used to stream the backfill data from the database.
   */
  readonly backfill: BackfillStream<EntityRow<S>>;
  /**
   * The transform is used to transform the rows before they are published.
   */
  readonly transform?: Transform<EntityRow<S>>;
};

export type EventDefinition<S extends EntitySchema> = {
  readonly name: string;
  readonly schema: S;
  /**
   * The live source is used to stream the live data from the database.
   */
  readonly live: LiveSource<EntityRow<S>>;
  /**
   * The backfill stream is used to stream the backfill data from the database.
   */
  readonly backfill?: BackfillStream<EntityRow<S>>;
  /**
   * The transform is used to transform the rows before they are published.
   */
  readonly transform?: Transform<EntityRow<S>>;
};

export type ConnectorDefinition<
  Entities extends ReadonlyArray<
    EntityDefinition<EntitySchema>
  > = ReadonlyArray<EntityDefinition<EntitySchema>>,
  Events extends ReadonlyArray<EventDefinition<EntitySchema>> = ReadonlyArray<
    EventDefinition<EntitySchema>
  >,
> = {
  readonly name: string;
  readonly entities: Entities;
  readonly events: Events;
};
