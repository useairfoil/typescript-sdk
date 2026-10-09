import type { ResourceBatch } from "@useairfoil/connector-kit";

import { ConnectorError, Ingestor } from "@useairfoil/connector-kit";
import { ConfigProvider, Deferred, Effect, Layer, Option, Ref, Schema } from "effect";
import { createHmac } from "node:crypto";

import type { GitHubClientService } from "../src/client/client";

import { GitHubClient, GitHubConnector } from "../src/index";
import { installationId } from "./fixtures/objects";

export const webhookSecret = "webhook-test-secret";

export const testConfig = ConfigProvider.layer(
  ConfigProvider.fromUnknown({
    GITHUB_APP_CLIENT_ID: "Iv23liTest",
    // The fake client never signs a JWT.
    GITHUB_APP_PRIVATE_KEY: "unused",
    GITHUB_INSTALLATION_ID: String(installationId),
    GITHUB_WEBHOOK_SECRET: webhookSecret,
  }),
);

export type FakePage = { readonly body: unknown; readonly next?: string };

/** Pages by request path and query, such as `/installation/repositories?per_page=100`. */
export type FakeGitHub = (url: string) => FakePage | undefined;

const decode = <A>(schema: Schema.Decoder<A>, value: unknown, url: string) =>
  Schema.decodeUnknownEffect(schema)(value).pipe(
    Effect.mapError(
      (cause) =>
        new ConnectorError({
          message: `Fixture for ${url} does not decode`,
          cause,
        }),
    ),
  );

/**
 * A fake GitHub client. It decodes fixture JSON with the real schemas, so the
 * tests also cover decoding, and it records every request.
 */
export const makeFakeClient = (fake: FakeGitHub) =>
  Effect.gen(function* () {
    const requests = yield* Ref.make<ReadonlyArray<string>>([]);
    const client: GitHubClientService = {
      get: (schema, url) =>
        Effect.gen(function* () {
          yield* Ref.update(requests, (current) => [...current, decodeURIComponent(url)]);
          // Fixtures are keyed by readable URLs.
          const page = fake(decodeURIComponent(url));
          if (page === undefined) {
            return yield* new ConnectorError({
              message: `GitHub API returned 404 for ${url}`,
            });
          }
          return {
            body: yield* decode(schema, page.body, url),
            next: Option.fromNullishOr(page.next),
          };
        }),
    };
    return { client, requests };
  });

export const connectorLayer = (client: GitHubClientService) =>
  Layer.effect(GitHubConnector.GitHubConnector)(
    GitHubConnector.GitHubConfigDef.config.pipe(Effect.flatMap(GitHubConnector.make)),
  ).pipe(
    Layer.provide(Layer.succeed(GitHubClient.GitHubClient)(client)),
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

export const signPayload = (payload: string, secret = webhookSecret) =>
  `sha256=${createHmac("sha256", secret).update(payload).digest("hex")}`;

/** A copy without `key`, like a payload that leaves a field out. */
export const without = <A extends object, K extends keyof A>(value: A, key: K): Omit<A, K> => {
  const { [key]: _removed, ...rest } = value;
  return rest;
};
