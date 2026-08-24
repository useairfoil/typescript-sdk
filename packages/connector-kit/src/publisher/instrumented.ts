import { Effect, Metric } from "effect";

import type { ResourceBatch } from "../core/types";

import { ConnectorError } from "../errors";
import * as Metrics from "../metrics";
import { Attr, EventAttr, EventName, addCurrentSpanEvent } from "../telemetry";
import { Publisher, type PublishSource } from "./service";

export const publishBatch = Effect.fnUntraced(function* (options: {
  readonly connector?: string;
  readonly resource: string;
  readonly source: PublishSource;
  readonly batch: ResourceBatch;
}) {
  const metric = {
    connector: options.connector ?? "unknown",
    resource: options.resource,
    source: options.source,
  };
  const metricAttributes = Metrics.withResourceAttributes(metric);
  const upserts = options.batch.mutations.filter((mutation) => mutation.op === "upsert").length;
  const deletes = options.batch.mutations.length - upserts;

  const publisher = yield* Publisher;
  const ack = yield* publisher
    .publish({
      resource: options.resource,
      source: options.source,
      batch: options.batch,
    })
    .pipe(
      Effect.trackDuration(Metric.withAttributes(Metrics.publishDuration, metricAttributes)),
      Effect.catchCause((cause) =>
        Metric.update(
          Metric.withAttributes(Metrics.batches, {
            ...metricAttributes,
            [Attr.batchOutcome]: "error",
          }),
          1,
        ).pipe(Effect.andThen(Effect.failCause(cause))),
      ),
    );

  yield* Metric.update(
    Metric.withAttributes(Metrics.batches, {
      ...metricAttributes,
      [Attr.batchOutcome]: ack.status,
    }),
    1,
  );

  yield* Effect.annotateCurrentSpan({ [Attr.publisherSuccess]: ack.status === "accepted" });
  if (ack.status === "rejected") {
    yield* Effect.annotateCurrentSpan({ [Attr.errorPhase]: "publish" });
    return yield* Effect.fail(
      new ConnectorError({
        message: `Publisher rejected batch for ${options.resource}: ${ack.reason}`,
      }),
    );
  }

  yield* Metric.update(Metric.withAttributes(Metrics.entitiesUpserted, metricAttributes), upserts);
  yield* Metric.update(Metric.withAttributes(Metrics.entitiesDeleted, metricAttributes), deletes);
  yield* Metric.update(
    Metric.withAttributes(Metrics.batchSize, metricAttributes),
    options.batch.mutations.length,
  );

  if (options.batch.cursor !== undefined) {
    yield* addCurrentSpanEvent(EventName.batchCheckpoint, {
      [EventAttr.batchCursor]: options.batch.cursor,
    });
  }
});
