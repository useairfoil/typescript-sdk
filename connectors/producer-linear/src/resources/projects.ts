import { Resource } from "@useairfoil/connector-kit";

import type { LinearClientService } from "../client/client";

import {
  ProjectLabelObjectSchema,
  ProjectLabelSchema,
  ProjectMilestoneObjectSchema,
  ProjectMilestoneSchema,
  ProjectObjectSchema,
  ProjectRelationObjectSchema,
  ProjectRelationSchema,
  ProjectSchema,
  ProjectStatusObjectSchema,
  ProjectStatusSchema,
  ProjectUpdateObjectSchema,
  ProjectUpdateSchema,
} from "../schemas/projects";
import {
  backfillList,
  changesList,
  checkList,
  listSources,
  listSpec,
  rowsOf,
  webhookList,
} from "./pages";

const projectSpec = listSpec({
  connection: "projects",
  single: "project",
  fields: `id created_at: createdAt updated_at: updatedAt archived_at: archivedAt
    name description content url icon color status_id: status { id } priority
    priority_label: priorityLabel health health_updated_at: healthUpdatedAt progress scope
    lead_id: lead { id } creator_id: creator { id }
    converted_from_issue_id: convertedFromIssue { id } start_date: startDate
    target_date: targetDate started_at: startedAt completed_at: completedAt
    canceled_at: canceledAt auto_archived_at: autoArchivedAt label_ids: labelIds
    team_ids: teams(first: 50) { nodes { id } } member_ids: members(first: 100) { nodes { id } }
    trashed`,
  item: ProjectObjectSchema,
  // Each project reads up to 150 teams and members, so pages stay under the cost limit.
  first: 50,
  updatedAt: (project) => project.updated_at,
  rows: rowsOf((project) => ({ ...project, version: project.updated_at, _deleted: false })),
});

export const makeProjects = (client: LinearClientService) =>
  Resource.entity({
    name: "projects",
    rowSchema: ProjectSchema,
    version: "version",

    check: checkList(client, projectSpec),
    backfill: backfillList(client, projectSpec),
    changes: changesList(client, projectSpec),
    webhook: webhookList(client, projectSpec),
  });

const projectMilestoneSpec = listSpec({
  connection: "projectMilestones",
  fields: `id created_at: createdAt updated_at: updatedAt archived_at: archivedAt
    name description project_id: project { id } target_date: targetDate status progress
    sort_order: sortOrder`,
  item: ProjectMilestoneObjectSchema,
  updatedAt: (milestone) => milestone.updated_at,
  rows: rowsOf((milestone) => ({ ...milestone, version: milestone.updated_at })),
});

export const makeProjectMilestones = (client: LinearClientService) =>
  Resource.entity({
    name: "project_milestones",
    rowSchema: ProjectMilestoneSchema,
    version: "version",

    check: checkList(client, projectMilestoneSpec),
    backfill: backfillList(client, projectMilestoneSpec),
    changes: changesList(client, projectMilestoneSpec),
  });

const projectUpdateSpec = listSpec({
  connection: "projectUpdates",
  single: "projectUpdate",
  fields: `id created_at: createdAt updated_at: updatedAt archived_at: archivedAt
    project_id: project { id } user_id: user { id } body health url edited_at: editedAt
    comment_count: commentCount`,
  item: ProjectUpdateObjectSchema,
  updatedAt: (update) => update.updated_at,
  rows: rowsOf((update) => ({ ...update, version: update.updated_at, _deleted: false })),
});

export const makeProjectUpdates = (client: LinearClientService) =>
  Resource.entity({
    name: "project_updates",
    rowSchema: ProjectUpdateSchema,
    version: "version",

    check: checkList(client, projectUpdateSpec),
    backfill: backfillList(client, projectUpdateSpec),
    changes: changesList(client, projectUpdateSpec),
    webhook: webhookList(client, projectUpdateSpec),
  });

const projectStatusSpec = listSpec({
  connection: "projectStatuses",
  fields: `id created_at: createdAt updated_at: updatedAt archived_at: archivedAt name type color description position`,
  item: ProjectStatusObjectSchema,
  updatedAt: (status) => status.updated_at,
  rows: rowsOf((status) => ({ ...status, version: status.updated_at })),
});

export const makeProjectStatuses = (client: LinearClientService) =>
  Resource.entity({
    name: "project_statuses",
    rowSchema: ProjectStatusSchema,
    version: "version",
    ...listSources(client, projectStatusSpec),
  });

const projectLabelSpec = listSpec({
  connection: "projectLabels",
  single: "projectLabel",
  fields: `id created_at: createdAt updated_at: updatedAt archived_at: archivedAt
    name description color is_group: isGroup parent_id: parent { id }
    creator_id: creator { id } retired_at: retiredAt`,
  item: ProjectLabelObjectSchema,
  updatedAt: (label) => label.updated_at,
  rows: rowsOf((label) => ({ ...label, version: label.updated_at, _deleted: false })),
});

export const makeProjectLabels = (client: LinearClientService) =>
  Resource.entity({
    name: "project_labels",
    rowSchema: ProjectLabelSchema,
    version: "version",
    ...listSources(client, projectLabelSpec),
    webhook: webhookList(client, projectLabelSpec),
  });

const projectRelationSpec = listSpec({
  connection: "projectRelations",
  fields: `id created_at: createdAt updated_at: updatedAt archived_at: archivedAt
    type project_id: project { id } project_milestone_id: projectMilestone { id }
    anchor_type: anchorType related_project_id: relatedProject { id }
    related_project_milestone_id: relatedProjectMilestone { id }
    related_anchor_type: relatedAnchorType user_id: user { id }`,
  item: ProjectRelationObjectSchema,
  updatedAt: (relation) => relation.updated_at,
  rows: rowsOf((relation) => ({ ...relation, version: relation.updated_at })),
});

export const makeProjectRelations = (client: LinearClientService) =>
  Resource.entity({
    name: "project_relations",
    rowSchema: ProjectRelationSchema,
    version: "version",

    check: checkList(client, projectRelationSpec),
    backfill: backfillList(client, projectRelationSpec),
    changes: changesList(client, projectRelationSpec),
  });
