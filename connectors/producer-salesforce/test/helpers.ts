import { ConnectorError } from "@useairfoil/connector-kit";
import { Effect, Layer, Ref, Schema } from "effect";

import type { SalesforceClientService } from "../src/client/client";

import { SalesforceClient, SalesforceConnector } from "../src/index";
import { PicklistValueSchema } from "../src/schemas/api";

export type FakeRequest = {
  readonly method: "GET" | "POST";
  readonly path: string;
  readonly params?: Readonly<Record<string, string>>;
  readonly body?: unknown;
};

/** Answers a request with a response body, or undefined for a 404. */
export type FakeSalesforce = (request: FakeRequest) => unknown;

export const fetchedAt = new Date("2026-10-15T12:00:00.000Z");

/**
 * A fake Salesforce client. It decodes fixtures with the real schemas, so the
 * tests also cover decoding, and it records every request.
 */
export const makeFakeClient = (fake: FakeSalesforce) =>
  Effect.gen(function* () {
    const requests = yield* Ref.make<ReadonlyArray<FakeRequest>>([]);
    const answer = <A>(schema: Schema.Decoder<A>, request: FakeRequest) =>
      Effect.gen(function* () {
        yield* Ref.update(requests, (current) => [...current, request]);
        const body = fake(request);
        if (body === undefined) {
          return yield* new ConnectorError({
            message: `Salesforce API returned 404 for ${request.path}`,
          });
        }
        const decoded = yield* Schema.decodeUnknownEffect(schema)(body).pipe(
          Effect.mapError(
            (cause) =>
              new ConnectorError({ message: `Fixture for ${request.path} does not decode`, cause }),
          ),
        );
        return { body: decoded, fetchedAt };
      });
    const client: SalesforceClientService = {
      get: (schema, path, params) =>
        answer(schema, { method: "GET", path, ...(params === undefined ? {} : { params }) }),
      post: (schema, path, body) => answer(schema, { method: "POST", path, body }),
    };
    return { client, requests };
  });

export const connectorLayer = (client: SalesforceClientService) =>
  Layer.effect(SalesforceConnector.SalesforceConnector)(SalesforceConnector.make()).pipe(
    Layer.provide(Layer.succeed(SalesforceClient.SalesforceClient)(client)),
  );

type PicklistValue = typeof PicklistValueSchema.Encoded;

export const describeField = (name: string, type = "string") => ({
  name,
  label: name,
  type,
  custom: name.endsWith("__c"),
  calculated: false,
  nillable: name !== "Id",
  length: type === "string" ? 255 : 0,
  precision: 0,
  scale: 0,
  referenceTo: new Array<string>(),
  picklistValues: new Array<PicklistValue>(),
});

export const objectDescribe = (
  name: string,
  fields: ReadonlyArray<ReturnType<typeof describeField>>,
  options: { readonly replicateable?: boolean } = {},
) => ({ name, replicateable: options.replicateable ?? true, fields });

// Bigints, dates, and maps print plainly in snapshots.
export const plain = (value: unknown): unknown =>
  JSON.parse(
    JSON.stringify(value, (_key, item) =>
      typeof item === "bigint" ? `${item}n` : item instanceof Map ? Object.fromEntries(item) : item,
    ),
  );
