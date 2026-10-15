import { Connector, type ResourceDefinition } from "@useairfoil/connector-kit";
import { Config, Context, Duration, Effect, Exit, Layer, Option, Redacted } from "effect";

import type { HubSpotConfig } from "./manifest";

import * as HubSpotClient from "./client/client";
import { customObjectTypes, makeCustomObjects } from "./resources/custom-objects";
import { makeLists } from "./resources/lists";
import { makeCrmResources } from "./resources/objects";
import { makeOwners } from "./resources/owners";
import { makePipelines } from "./resources/pipelines";
import { makeProperties } from "./resources/properties";
import { makeTeams } from "./resources/teams";
import { AccountSchema } from "./schemas/api";
import { makeWebhookRoute } from "./webhook/route";
export { HubSpotConfigDef, manifest } from "./manifest";
export type { HubSpotConfig } from "./manifest";

// Other standard objects reject the pipelines API.
const pipelineObjects = new Set(["deals", "tickets", "leads", "orders"]);

export const make = Effect.fnUntraced(function* (config: HubSpotConfig) {
  const client = yield* HubSpotClient.HubSpotClient;
  const crm = yield* makeCrmResources(client);
  const customTypes = yield* customObjectTypes(client);
  const customObjects = yield* makeCustomObjects(client, customTypes);
  // Without the custom objects scope, these skip custom types and
  // `custom_objects` shows the error.
  const customTypeIds = customTypes.pipe(
    Effect.map((types) => types.map((type) => type.objectTypeId)),
    Effect.orElseSucceed(() => []),
  );
  const crmTypes = Object.values(crm).map((resource) => resource.name);
  const propertyTypes = customTypeIds.pipe(Effect.map((ids) => [...crmTypes, ...ids]));
  const pipelineTypes = customTypeIds.pipe(
    Effect.map((ids) => [...crmTypes.filter((name) => pipelineObjects.has(name)), ...ids]),
  );
  const portalId = yield* client
    .get(AccountSchema, `/account-info/${HubSpotClient.HUBSPOT_API_VERSION}/details`)
    .pipe(
      Effect.map(({ body }) => body.portalId),
      Effect.cachedWithTTL((exit) => (Exit.isSuccess(exit) ? Duration.infinity : Duration.zero)),
    );

  if (Option.isNone(config.clientSecret)) {
    yield* Effect.logInfo(
      "HUBSPOT_CLIENT_SECRET is not set. Webhooks are off, and changes come from polling.",
    );
  }

  return Connector.define({
    name: "producer-hubspot",
    title: "HubSpot",
    resources: [
      ...Object.values(crm),
      customObjects,
      makeOwners(client),
      makePipelines(client, pipelineTypes),
      makeProperties(client, propertyTypes),
      makeTeams(client),
      makeLists(client),
    ],
    webhooks: Option.match(config.clientSecret, {
      onNone: () => [],
      onSome: (secret) => [
        makeWebhookRoute({
          secret: Redacted.value(secret),
          portalId,
          targets: new Map<string, ResourceDefinition>(Object.entries(crm)),
          customObjects,
        }),
      ],
    }),
  });
});

export type HubSpotConnectorRuntime = Effect.Success<ReturnType<typeof make>>;

export class HubSpotConnector extends Context.Service<HubSpotConnector, HubSpotConnectorRuntime>()(
  "@useairfoil/producer-hubspot/HubSpotConnector",
) {}

export const layer = (config: HubSpotConfig) =>
  Layer.effect(HubSpotConnector)(
    make(config).pipe(Effect.annotateLogs({ component: "hubspot" })),
  ).pipe(Layer.provide(HubSpotClient.layer(config)));

export const layerConfig = (config: Config.Wrap<HubSpotConfig>) =>
  Layer.unwrap(Config.unwrap(config).pipe(Effect.map(layer)));
