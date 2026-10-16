import { Connector, type ResourceDefinition } from "@useairfoil/connector-kit";
import { Config, Context, Effect, Layer, Redacted } from "effect";

import type { LinearConfig } from "./manifest";

import * as LinearClient from "./client/client";
import { makeComments } from "./resources/comments";
import {
  makeCustomerNeeds,
  makeCustomerStatuses,
  makeCustomerTiers,
  makeCustomers,
} from "./resources/customers";
import { makeDocuments } from "./resources/documents";
import {
  makeInitiativeLabels,
  makeInitiativeRelations,
  makeInitiativeToProjects,
  makeInitiativeUpdates,
  makeInitiatives,
} from "./resources/initiatives";
import { makeIssueHistory } from "./resources/issue-history";
import {
  makeAttachments,
  makeIssueLabels,
  makeIssueRelations,
  makeIssues,
} from "./resources/issues";
import {
  makeProjectLabels,
  makeProjectMilestones,
  makeProjectRelations,
  makeProjectStatuses,
  makeProjectUpdates,
  makeProjects,
} from "./resources/projects";
import {
  makeIssueToReleases,
  makeReleaseNotes,
  makeReleasePipelines,
  makeReleaseStages,
  makeReleases,
} from "./resources/releases";
import {
  makeCycles,
  makeExternalUsers,
  makeTeamMemberships,
  makeTeams,
  makeUsers,
  makeWorkflowStates,
} from "./resources/teams";
import { makeWebhookRoute } from "./webhook/route";
export { LinearConfigDef, manifest } from "./manifest";
export type { LinearConfig } from "./manifest";

export const make = Effect.fnUntraced(function* (config: LinearConfig) {
  const client = yield* LinearClient.LinearClient;

  const Issues = makeIssues(client);
  const IssueHistory = makeIssueHistory(client);
  const Comments = makeComments(client);
  const Attachments = makeAttachments(client);
  const IssueLabels = makeIssueLabels(client);
  const Users = makeUsers(client);
  const Cycles = makeCycles(client);
  const Projects = makeProjects(client);
  const ProjectUpdates = makeProjectUpdates(client);
  const ProjectLabels = makeProjectLabels(client);
  const Initiatives = makeInitiatives(client);
  const InitiativeUpdates = makeInitiativeUpdates(client);
  const Documents = makeDocuments(client);
  const Customers = makeCustomers(client);
  const CustomerNeeds = makeCustomerNeeds(client);

  return Connector.define({
    name: "producer-linear",
    title: "Linear",
    resources: [
      Issues,
      IssueHistory,
      Comments,
      makeIssueRelations(client),
      Attachments,
      IssueLabels,
      makeWorkflowStates(client),
      makeTeams(client),
      makeTeamMemberships(client),
      Users,
      makeExternalUsers(client),
      Cycles,
      Projects,
      makeProjectMilestones(client),
      ProjectUpdates,
      makeProjectStatuses(client),
      ProjectLabels,
      makeProjectRelations(client),
      Initiatives,
      InitiativeUpdates,
      makeInitiativeLabels(client),
      makeInitiativeRelations(client),
      makeInitiativeToProjects(client),
      Documents,
      Customers,
      CustomerNeeds,
      makeCustomerStatuses(client),
      makeCustomerTiers(client),
      makeReleases(client),
      makeReleaseNotes(client),
      makeReleasePipelines(client),
      makeReleaseStages(client),
      makeIssueToReleases(client),
    ],
    webhooks: [
      makeWebhookRoute({
        secret: Redacted.value(config.webhookSecret),
        issueHistory: IssueHistory,
        // Release webhooks need the Business plan.
        targets: new Map<string, ResourceDefinition>([
          ["Issue", Issues],
          ["Comment", Comments],
          ["Attachment", Attachments],
          ["IssueLabel", IssueLabels],
          ["User", Users],
          ["Cycle", Cycles],
          ["Project", Projects],
          ["ProjectUpdate", ProjectUpdates],
          ["ProjectLabel", ProjectLabels],
          ["Initiative", Initiatives],
          ["InitiativeUpdate", InitiativeUpdates],
          ["Document", Documents],
          ["Customer", Customers],
          ["CustomerNeed", CustomerNeeds],
        ]),
      }),
    ],
  });
});

export type LinearConnectorRuntime = Effect.Success<ReturnType<typeof make>>;

export class LinearConnector extends Context.Service<LinearConnector, LinearConnectorRuntime>()(
  "@useairfoil/producer-linear/LinearConnector",
) {}

export const layer = (config: LinearConfig) =>
  Layer.effect(LinearConnector)(
    make(config).pipe(Effect.annotateLogs({ component: "linear" })),
  ).pipe(Layer.provide(LinearClient.layer(config)));

export const layerConfig = (config: Config.Wrap<LinearConfig>) =>
  Layer.unwrap(Config.unwrap(config).pipe(Effect.map(layer)));
