import { ConnectorError, Ingestor } from "@useairfoil/connector-kit";
import { ConfigProvider, Deferred, Effect, Layer, Option, Ref, Schema } from "effect";
import { createHmac } from "node:crypto";

import type { LinearClientService } from "../src/client/client";

import { LinearClient, LinearConnector } from "../src/index";

export const webhookSecret = "webhook-test-secret";

export const testConfig = ConfigProvider.layer(
  ConfigProvider.fromUnknown({
    LINEAR_API_KEY: "lin_api_test",
    LINEAR_WEBHOOK_SECRET: webhookSecret,
  }),
);

export type FakeRequest = {
  readonly operation: string;
  readonly variables: Readonly<Record<string, unknown>>;
};

/** Answers a request with its `data`, or undefined for "Entity not found". */
export type FakeLinear = (request: FakeRequest) => unknown;

/** Uses real decoders and records requests for assertions. */
export const makeFakeClient = (fake: FakeLinear) =>
  Effect.gen(function* () {
    const requests = yield* Ref.make<ReadonlyArray<FakeRequest>>([]);
    const find = <A>(
      schema: Schema.Decoder<A>,
      document: string,
      variables: Readonly<Record<string, unknown>> = {},
    ) =>
      Effect.gen(function* () {
        const request = { operation: /query (\w+)/.exec(document)?.[1] ?? "query", variables };
        yield* Ref.update(requests, (current) => [...current, request]);
        return yield* Effect.transposeOption(
          Option.fromNullishOr(fake(request)).pipe(
            Option.map((data) =>
              Schema.decodeUnknownEffect(schema)(data).pipe(
                Effect.mapError(
                  (cause) =>
                    new ConnectorError({
                      message: `Fixture for ${request.operation} does not decode`,
                      cause,
                    }),
                ),
              ),
            ),
          ),
        );
      });
    const client: LinearClientService = {
      find,
      query: (schema, document, variables) =>
        find(schema, document, variables).pipe(
          Effect.flatMap(
            Option.match({
              onNone: () => Effect.fail(new ConnectorError({ message: "Entity not found" })),
              onSome: Effect.succeed,
            }),
          ),
        ),
    };
    return { client, requests };
  });

export const connectorLayer = (client: LinearClientService) =>
  Layer.effect(LinearConnector.LinearConnector)(
    LinearConnector.LinearConfigDef.config.pipe(Effect.flatMap(LinearConnector.make)),
  ).pipe(
    Layer.provide(Layer.succeed(LinearClient.LinearClient)(client)),
    Layer.provide(testConfig),
  );

export const page = (
  connection: string,
  nodes: ReadonlyArray<unknown>,
  endCursor: string | null = null,
) => ({ [connection]: { nodes, pageInfo: { hasNextPage: endCursor !== null, endCursor } } });

export type Ingested = {
  readonly resource: string;
  readonly source: string;
  readonly batch: { readonly rows: ReadonlyArray<object> };
};

export const makeTestIngestor = (expected: number) =>
  Effect.gen(function* () {
    const ingestedRef = yield* Ref.make<ReadonlyArray<Ingested>>([]);
    const done = yield* Deferred.make<number, never>();
    const layer = Layer.succeed(Ingestor.Ingestor)({
      ingest: ({ resource, source, batch }) =>
        Effect.gen(function* () {
          const next = yield* Ref.updateAndGet(ingestedRef, (items) => [
            ...items,
            { resource, source, batch },
          ]);
          if (next.length === expected) {
            yield* Deferred.succeed(done, next.length);
          }
        }),
    });

    return { ingestedRef, done, layer };
  });

export const signPayload = (payload: string, secret = webhookSecret) =>
  createHmac("sha256", secret).update(payload).digest("hex");

export const plain = (value: unknown): unknown =>
  JSON.parse(JSON.stringify(value, (_key, item) => (typeof item === "bigint" ? `${item}n` : item)));

export const pick = (rows: ReadonlyArray<object>, keys: ReadonlyArray<string>) =>
  plain(
    rows.map((row) =>
      Object.fromEntries(Object.entries(row).filter(([key]) => keys.includes(key))),
    ),
  );
