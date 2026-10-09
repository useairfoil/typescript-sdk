import { ConnectorError } from "@useairfoil/connector-kit";
import { Effect, Layer, Option, Ref, Schema } from "effect";

import type { ZendeskClientService } from "../src/client/client";

import { ZendeskClient, ZendeskConnector } from "../src/index";

export type FakeRequest = {
  readonly path: string;
  readonly params: Readonly<Record<string, string>>;
};

/** Answers a request with a response body, or undefined for a 404. */
export type FakeZendesk = (request: FakeRequest) => unknown;

const decode = <A>(schema: Schema.Decoder<A>, value: unknown, path: string) =>
  Schema.decodeUnknownEffect(schema)(value).pipe(
    Effect.mapError(
      (cause) => new ConnectorError({ message: `Fixture for ${path} does not decode`, cause }),
    ),
  );

export const makeFakeClient = (fake: FakeZendesk) =>
  Effect.gen(function* () {
    const requests = yield* Ref.make<ReadonlyArray<FakeRequest>>([]);
    const find = <A>(
      schema: Schema.Decoder<A>,
      path: string,
      params: Readonly<Record<string, string>> = {},
    ) =>
      Effect.gen(function* () {
        const request = { path, params };
        yield* Ref.update(requests, (current) => [...current, request]);
        return yield* Effect.transposeOption(
          Option.fromNullishOr(fake(request)).pipe(
            Option.map((body) => decode(schema, body, path)),
          ),
        );
      });
    const client: ZendeskClientService = {
      find,
      get: (schema, path, params) =>
        find(schema, path, params).pipe(
          Effect.flatMap(
            Option.match({
              onNone: () =>
                Effect.fail(
                  new ConnectorError({ message: `Zendesk API returned 404 for ${path}` }),
                ),
              onSome: Effect.succeed,
            }),
          ),
        ),
    };
    return { client, requests };
  });

export const connectorLayer = (client: ZendeskClientService) =>
  Layer.effect(ZendeskConnector.ZendeskConnector)(ZendeskConnector.make()).pipe(
    Layer.provide(Layer.succeed(ZendeskClient.ZendeskClient)(client)),
  );

export const describeRequest = (request: FakeRequest) =>
  [request.path, new URLSearchParams(request.params).toString()]
    .filter((part) => part !== "")
    .join(" ");

export const plain = (value: unknown): unknown =>
  JSON.parse(
    JSON.stringify(value, (_key, item) =>
      typeof item === "bigint" ? `${item}n` : item instanceof Map ? Object.fromEntries(item) : item,
    ),
  );

export const pick = (rows: ReadonlyArray<object>, keys: ReadonlyArray<string>) =>
  plain(
    rows.map((row) =>
      Object.fromEntries(Object.entries(row).filter(([key]) => keys.includes(key))),
    ),
  );
