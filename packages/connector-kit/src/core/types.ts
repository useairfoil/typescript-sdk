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

export type EntityDefinition<T extends Record<string, unknown>> = {
  readonly name: string;
  // biome-ignore lint/suspicious/noExplicitAny: Effect schema is invariant.
  readonly schema: Schema.Schema<T, any, any>;
  /**
   * The primary key is used to identify the rows in the database.
   */
  readonly primaryKey: keyof T & string;
  /**
   * The live source is used to stream the live data from the database.
   */
  readonly live: LiveSource<T>;
  /**
   * The backfill stream is used to stream the backfill data from the database.
   */
  readonly backfill: BackfillStream<T>;
  /**
   * The transform is used to transform the rows before they are published.
   */
  readonly transform?: Transform<T>;
};

export type EventDefinition<T extends Record<string, unknown>> = {
  readonly name: string;
  // biome-ignore lint/suspicious/noExplicitAny: Effect schema is invariant.
  readonly schema: Schema.Schema<T, any, any>;
  /**
   * The live source is used to stream the live data from the database.
   */
  readonly live: LiveSource<T>;
  /**
   * The backfill stream is used to stream the backfill data from the database.
   */
  readonly backfill?: BackfillStream<T>;
  /**
   * The transform is used to transform the rows before they are published.
   */
  readonly transform?: Transform<T>;
};

export type ConnectorDefinition<Config = unknown> = {
  readonly name: string;
  readonly config: Config;
  // biome-ignore lint/suspicious/noExplicitAny: Connector holds heterogeneous definitions.
  readonly entities: ReadonlyArray<EntityDefinition<any>>;
  // biome-ignore lint/suspicious/noExplicitAny: Connector holds heterogeneous definitions.
  readonly events: ReadonlyArray<EventDefinition<any>>;
};
