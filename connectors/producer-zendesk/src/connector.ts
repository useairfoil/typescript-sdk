import { Connector } from "@useairfoil/connector-kit";
import { Config, Context, Effect, Layer } from "effect";

import type { ZendeskConfig } from "./manifest";

import * as ZendeskClient from "./client/client";
import { makeCsatSurveys, makeSurveyResponses } from "./resources/csat";
import {
  makeBrands,
  makeCustomStatuses,
  makeGroups,
  makeTicketFields,
  makeTicketForms,
} from "./resources/lists";
import { makeOrganizations } from "./resources/organizations";
import { makeTicketComments } from "./resources/ticket-comments";
import { makeTickets } from "./resources/tickets";
import { makeUsers } from "./resources/users";
export { ZendeskConfigDef, manifest } from "./manifest";
export type { ZendeskConfig } from "./manifest";

export const make = Effect.fnUntraced(function* () {
  const client = yield* ZendeskClient.ZendeskClient;

  return Connector.define({
    name: "producer-zendesk",
    title: "Zendesk",
    resources: [
      makeTickets(client),
      makeTicketComments(client),
      makeUsers(client),
      makeOrganizations(client),
      makeGroups(client),
      makeBrands(client),
      makeTicketFields(client),
      makeTicketForms(client),
      makeCustomStatuses(client),
      makeSurveyResponses(client),
      makeCsatSurveys(client),
    ],
  });
});

export type ZendeskConnectorRuntime = Effect.Success<ReturnType<typeof make>>;

export class ZendeskConnector extends Context.Service<ZendeskConnector, ZendeskConnectorRuntime>()(
  "@useairfoil/producer-zendesk/ZendeskConnector",
) {}

export const layer = (config: ZendeskConfig) =>
  Layer.effect(ZendeskConnector)(make().pipe(Effect.annotateLogs({ component: "zendesk" }))).pipe(
    Layer.provide(ZendeskClient.layer(config)),
  );

export const layerConfig = (config: Config.Wrap<ZendeskConfig>) =>
  Layer.unwrap(Config.unwrap(config).pipe(Effect.map(layer)));
