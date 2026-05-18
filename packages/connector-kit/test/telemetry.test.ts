import { NodeHttpServer } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Exit, Layer, Ref, Schema, Stream } from "effect";
import { HttpClient, HttpClientRequest } from "effect/unstable/http";

import type { Cursor, IngestionState } from "../src/core/types";

import { defineConnector, defineEvent } from "../src/core/builder";
import { ConnectorError } from "../src/errors";
import { runConnector } from "../src/ingestion/engine";
import { layerMemory, StateStore } from "../src/ingestion/state-store";
import { Publisher } from "../src/publisher/service";
import { Attr, EventAttr, EventName, SpanName } from "../src/telemetry";
import { makeRecordingTracer } from "./telemetry-helpers";

type TestRow = { readonly id: string; readonly created_at: string };

const TestRowSchema = Schema.Struct({
  id: Schema.String,
  created_at: Schema.String,
});

const row: TestRow = {
  id: "event-1",
  created_at: "2024-01-01T00:00:00Z",
};

const makeEventConnector = (options?: {
  readonly transform?: (row: TestRow) => Effect.Effect<TestRow, ConnectorError>;
}) => {
  const event = defineEvent({
    name: "events",
    schema: TestRowSchema,
    live: Stream.empty,
    backfill: Stream.make({ cursor: "2024-01-01T00:00:00Z", rows: [row] }),
    transform: options?.transform,
  });

  return defineConnector({
    name: "test",
    entities: [],
    events: [event],
  });
};

const makeWebhookConnector = () => {
  const event = defineEvent({
    name: "keepalive",
    schema: TestRowSchema,
    live: Stream.never,
  });

  return defineConnector({
    name: "webhook-test",
    entities: [],
    events: [event],
  });
};

const successPublisherLayer = Layer.succeed(Publisher)({
  publish: () => Effect.succeed({ success: true }),
});

const runWithTelemetry = <A, E, R>(effect: Effect.Effect<A, E, R>) => {
  const recording = makeRecordingTracer();
  return Effect.gen(function* () {
    const result = yield* Effect.exit(effect.pipe(Effect.provide(recording.layer)));
    return { result, spans: recording.spans };
  });
};

describe("connector-kit telemetry", () => {
  it.effect("records successful connector and batch spans", () =>
    Effect.gen(function* () {
      const connector = makeEventConnector();

      const { result, spans } = yield* runWithTelemetry(
        runConnector(connector, { initialCutoff: "2024-01-02T00:00:00Z" }).pipe(
          Effect.provide(Layer.mergeAll(layerMemory, successPublisherLayer)),
        ),
      );

      expect(Exit.isSuccess(result)).toBe(true);

      const batchSpan = spans.find((span) => span.name === SpanName.batchProcess);
      expect(batchSpan?.attributes.get(Attr.connectorName)).toBe("test");
      expect(batchSpan?.attributes.get(Attr.streamName)).toBe("events");
      expect(batchSpan?.attributes.get(Attr.streamSource)).toBe("backfill");
      expect(batchSpan?.attributes.get(Attr.batchRows)).toBe(1);
      const checkpointEvent = batchSpan?.events.find(
        ([name]) => name === EventName.batchCheckpoint,
      );
      expect(checkpointEvent?.[2][EventAttr.batchCursor]).toBe("2024-01-01T00:00:00Z");
      expect(batchSpan?.status._tag).toBe("Ended");
      expect(batchSpan?.status._tag === "Ended" && Exit.isSuccess(batchSpan.status.exit)).toBe(
        true,
      );
    }).pipe(Effect.scoped),
  );

  it.effect("annotates publisher rejections on the batch span", () =>
    Effect.gen(function* () {
      const connector = makeEventConnector();
      const rejectingPublisherLayer = Layer.succeed(Publisher)({
        publish: () => Effect.succeed({ success: false }),
      });

      const { result, spans } = yield* runWithTelemetry(
        runConnector(connector, { initialCutoff: "2024-01-02T00:00:00Z" }).pipe(
          Effect.provide(Layer.mergeAll(layerMemory, rejectingPublisherLayer)),
        ),
      );

      expect(Exit.isFailure(result)).toBe(true);

      const batchSpan = spans.find((span) => span.name === SpanName.batchProcess);
      expect(batchSpan?.attributes.get(Attr.errorPhase)).toBe("publish");
      expect(batchSpan?.attributes.get(Attr.publisherSuccess)).toBe(false);
      expect(batchSpan?.status._tag === "Ended" && Exit.isFailure(batchSpan.status.exit)).toBe(
        true,
      );
    }).pipe(Effect.scoped),
  );

  it.effect("annotates transform failures on the batch span", () =>
    Effect.gen(function* () {
      const connector = makeEventConnector({
        transform: () => Effect.fail(new ConnectorError({ message: "transform failed" })),
      });

      const { result, spans } = yield* runWithTelemetry(
        runConnector(connector, { initialCutoff: "2024-01-02T00:00:00Z" }).pipe(
          Effect.provide(Layer.mergeAll(layerMemory, successPublisherLayer)),
        ),
      );

      expect(Exit.isFailure(result)).toBe(true);

      const batchSpan = spans.find((span) => span.name === SpanName.batchProcess);
      expect(batchSpan?.attributes.get(Attr.errorPhase)).toBe("transform");
      expect(batchSpan?.attributes.get(Attr.errorType)).toBe("ConnectorError");
      expect(batchSpan?.attributes.get(Attr.errorMessage)).toBe("transform failed");
      expect(batchSpan?.attributes.get(Attr.errorDetails)).toBeUndefined();
    }).pipe(Effect.scoped),
  );

  it.effect("annotates error details on the batch span when cause is present", () =>
    Effect.gen(function* () {
      const rootCause = new Error("upstream failure");
      const connector = makeEventConnector({
        transform: () =>
          Effect.fail(new ConnectorError({ message: "transform failed", cause: rootCause })),
      });

      const { result, spans } = yield* runWithTelemetry(
        runConnector(connector, { initialCutoff: "2024-01-02T00:00:00Z" }).pipe(
          Effect.provide(Layer.mergeAll(layerMemory, successPublisherLayer)),
        ),
      );

      expect(Exit.isFailure(result)).toBe(true);

      const batchSpan = spans.find((span) => span.name === SpanName.batchProcess);
      expect(batchSpan?.attributes.get(Attr.errorType)).toBe("ConnectorError");
      expect(typeof batchSpan?.attributes.get(Attr.errorDetails)).toBe("string");
    }).pipe(Effect.scoped),
  );

  it.effect("records failed state set spans", () =>
    Effect.gen(function* () {
      const connector = makeEventConnector();
      const stateRef = yield* Ref.make(new Map<string, IngestionState<Cursor>>());
      const stateStoreLayer = Layer.succeed(StateStore)({
        getState: (key) => Effect.map(Ref.get(stateRef), (state) => state.get(key)),
        setState: () => Effect.fail(new ConnectorError({ message: "state set failed" })),
      });

      const { result, spans } = yield* runWithTelemetry(
        runConnector(connector, { initialCutoff: "2024-01-02T00:00:00Z" }).pipe(
          Effect.provide(Layer.mergeAll(stateStoreLayer, successPublisherLayer)),
        ),
      );

      expect(Exit.isFailure(result)).toBe(true);

      const stateSpan = spans.find((span) => span.name === SpanName.stateSet);
      expect(stateSpan?.attributes.get(Attr.stateKey)).toBe("events");
      expect(stateSpan?.attributes.get(Attr.errorPhase)).toBe("state_set");
      expect(stateSpan?.attributes.get(Attr.errorMessage)).toBe("state set failed");
      expect(stateSpan?.status._tag === "Ended" && Exit.isFailure(stateSpan.status.exit)).toBe(
        true,
      );
    }).pipe(Effect.scoped),
  );

  it.effect("records failed webhook decode spans", () => {
    const recording = makeRecordingTracer();
    const route = {
      path: "/webhook" as const,
      schema: Schema.Struct({ id: Schema.String }),
      handle: () => Effect.void,
    };
    const runLayer = Layer.mergeAll(
      NodeHttpServer.layerTest,
      layerMemory,
      successPublisherLayer,
      recording.layer,
    );

    return Effect.gen(function* () {
      yield* Effect.forkScoped(
        runConnector(makeWebhookConnector(), {
          initialCutoff: "2024-01-02T00:00:00Z",
          webhook: { routes: [route] },
        }),
      );

      const client = yield* HttpClient.HttpClient;
      const response = yield* client.execute(
        HttpClientRequest.post("/webhook").pipe(
          HttpClientRequest.bodyText("not-json", "application/json"),
        ),
      );

      expect(response.status).toBe(400);

      const decodeSpan = recording.spans.find((span) => span.name === SpanName.webhookDecode);
      expect(decodeSpan?.attributes.get(Attr.webhookPath)).toBe("/webhook");
      expect(decodeSpan?.attributes.get(Attr.errorPhase)).toBe("webhook_decode");
      expect(typeof decodeSpan?.attributes.get(Attr.errorDetails)).toBe("string");
      expect(decodeSpan?.status._tag === "Ended" && Exit.isFailure(decodeSpan.status.exit)).toBe(
        true,
      );
    }).pipe(Effect.provide(runLayer), Effect.scoped);
  });

  it.effect("records failed webhook handler spans", () => {
    const recording = makeRecordingTracer();
    const route = {
      path: "/webhook" as const,
      schema: Schema.Struct({ id: Schema.String }),
      handle: () => Effect.fail(new ConnectorError({ message: "handler failed" })),
    };
    const runLayer = Layer.mergeAll(
      NodeHttpServer.layerTest,
      layerMemory,
      successPublisherLayer,
      recording.layer,
    );

    return Effect.gen(function* () {
      yield* Effect.forkScoped(
        runConnector(makeWebhookConnector(), {
          initialCutoff: "2024-01-02T00:00:00Z",
          webhook: { routes: [route] },
        }),
      );

      const client = yield* HttpClient.HttpClient;
      const response = yield* client.execute(
        HttpClientRequest.post("/webhook").pipe(
          HttpClientRequest.bodyText(JSON.stringify({ id: "evt_1" }), "application/json"),
        ),
      );

      expect(response.status).toBe(500);

      const handleSpan = recording.spans.find((span) => span.name === SpanName.webhookHandle);
      expect(handleSpan?.attributes.get(Attr.webhookPath)).toBe("/webhook");
      expect(handleSpan?.attributes.get(Attr.errorPhase)).toBe("webhook_handle");
      expect(handleSpan?.attributes.get(Attr.errorMessage)).toBe("handler failed");
      expect(handleSpan?.status._tag === "Ended" && Exit.isFailure(handleSpan.status.exit)).toBe(
        true,
      );
    }).pipe(Effect.provide(runLayer), Effect.scoped);
  });
});
