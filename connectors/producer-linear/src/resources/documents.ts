import { Resource } from "@useairfoil/connector-kit";

import type { LinearClientService } from "../client/client";

import { DocumentObjectSchema, DocumentSchema } from "../schemas/documents";
import { backfillList, changesList, checkList, listSpec, rowsOf, webhookList } from "./pages";

const documentSpec = listSpec({
  connection: "documents",
  single: "document",
  fields: `id created_at: createdAt updated_at: updatedAt archived_at: archivedAt
    title content url icon color creator_id: creator { id } updated_by_id: updatedBy { id }
    project_id: project { id } initiative_id: initiative { id } issue_id: issue { id }
    cycle_id: cycle { id } team_id: team { id } parent_document_id: parentDocument { id }
    hidden_at: hiddenAt trashed`,
  item: DocumentObjectSchema,
  updatedAt: (document) => document.updated_at,
  rows: rowsOf((document) => ({ ...document, version: document.updated_at, _deleted: false })),
});

export const makeDocuments = (client: LinearClientService) =>
  Resource.entity({
    name: "documents",
    rowSchema: DocumentSchema,
    version: "version",

    check: checkList(client, documentSpec),
    backfill: backfillList(client, documentSpec),
    changes: changesList(client, documentSpec),
    webhook: webhookList(client, documentSpec),
  });
