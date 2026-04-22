import { Effect, Queue, Stream } from "effect";

import type { ConnectorError } from "../core/errors";
import type { Batch, WebhookStream } from "../core/types";

export const makeWebhookQueue = <T>(options?: {
  readonly capacity?: number;
}): Effect.Effect<WebhookStream<T>, never> =>
  Effect.gen(function* () {
    const capacity = options?.capacity ?? 1024;
    const queue = yield* Queue.bounded<Batch<T>>(capacity);
    const stream: Stream.Stream<Batch<T>, ConnectorError> = Stream.fromQueue(queue);
    return { queue, stream };
  });
