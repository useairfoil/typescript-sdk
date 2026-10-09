import type { ResourceBatch } from "@useairfoil/connector-kit";

import { ConnectorError, Ingestor } from "@useairfoil/connector-kit";
import { ConfigProvider, DateTime, Deferred, Effect, Layer, Option, Ref, Schema } from "effect";
import Stripe from "stripe";

import type { StripeClientService, StripeParams } from "../src/client/client";

import { StripeClient, StripeConnector } from "../src/index";

export const webhookSecret = "whsec_test_secret";

export const testConfig = ConfigProvider.layer(
  ConfigProvider.fromUnknown({
    STRIPE_API_KEY: "rk_test_fake",
    STRIPE_WEBHOOK_SECRET: webhookSecret,
  }),
);

export type FakeStripe = {
  /** List responses by path. Gets the request params. */
  readonly list?: (
    path: string,
    params: StripeParams,
  ) => { readonly data: ReadonlyArray<unknown>; readonly has_more: boolean };
  /** Objects by path. A missing path returns `404`. */
  readonly objects?: Readonly<Record<string, unknown>>;
};

export const formatRequest = (path: string, params: StripeParams): string =>
  params.length === 0
    ? path
    : `${path}?${params.map(([key, value]) => `${key}=${value}`).join("&")}`;

const decode = <A>(schema: Schema.Decoder<A>, value: unknown, path: string) =>
  Schema.decodeUnknownEffect(schema)(value).pipe(
    Effect.mapError(
      (cause) => new ConnectorError({ message: `Fixture for ${path} does not decode`, cause }),
    ),
  );

/**
 * A fake Stripe client. It decodes fixture JSON with the real schemas, so the
 * tests also cover decoding, and it records every request.
 */
export const makeFakeClient = (fake: FakeStripe) =>
  Effect.gen(function* () {
    const requests = yield* Ref.make<ReadonlyArray<string>>([]);
    const record = (path: string, params: StripeParams) =>
      Ref.update(requests, (current) => [...current, formatRequest(path, params)]);
    const fetchedAt = DateTime.nowAsDate;

    const client: StripeClientService = {
      list: (schema, path, params) =>
        Effect.gen(function* () {
          yield* record(path, params);
          const response = fake.list?.(path, params) ?? { data: [], has_more: false };
          const items = yield* decode(Schema.Array(schema), response.data, path);
          return { items, hasMore: response.has_more, fetchedAt: yield* fetchedAt };
        }),
      retrieve: (schema, path) =>
        Effect.gen(function* () {
          yield* record(path, []);
          const object = fake.objects?.[path];
          if (object === undefined) return Option.none();
          const item = yield* decode(schema, object, path);
          return Option.some({ item, fetchedAt: yield* fetchedAt });
        }),
    };

    return { client, requests };
  });

export const connectorLayer = (client: StripeClientService) =>
  Layer.effect(StripeConnector.StripeConnector)(
    StripeConnector.StripeConfigDef.config.pipe(Effect.flatMap(StripeConnector.make)),
  ).pipe(
    Layer.provide(Layer.succeed(StripeClient.StripeClient)(client)),
    Layer.provide(testConfig),
  );

export type Ingested = {
  readonly resource: string;
  readonly source: Ingestor.IngestSource;
  readonly batch: ResourceBatch;
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

// Stripe's own signing, so tests do not check our code against itself.
export const signPayload = (payload: string, options?: { readonly timestamp?: number }) =>
  Stripe.webhooks.generateTestHeaderString({
    payload,
    secret: webhookSecret,
    ...(options?.timestamp === undefined ? {} : { timestamp: options.timestamp }),
  });
