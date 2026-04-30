import { Effect, Queue, Stream } from "effect";

import type { Batch, WebhookStream } from "../core/types";
import type { ConnectorError } from "../errors";

export const makeWebhookQueue = Effect.fnUntraced(function* <T>(options?: {
  readonly capacity?: number;
}) {
  const capacity = options?.capacity ?? 1024;
  const queue = yield* Queue.bounded<Batch<T>>(capacity);
  const stream: Stream.Stream<Batch<T>, ConnectorError> = Stream.fromQueue(queue);
  return { queue, stream } satisfies WebhookStream<T>;
});
