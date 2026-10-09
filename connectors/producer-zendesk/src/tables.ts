import type { Schema } from "effect";

import { TicketCommentSchema } from "./schemas/comments";
import { CsatSurveySchema, SurveyResponseSchema } from "./schemas/csat";
import {
  BrandSchema,
  CustomStatusSchema,
  GroupSchema,
  TicketFieldSchema,
  TicketFormSchema,
} from "./schemas/lists";
import { OrganizationSchema } from "./schemas/organizations";
import { TicketSchema } from "./schemas/tickets";
import { UserSchema } from "./schemas/users";

export const tableSchemas: Readonly<Record<string, Schema.Top>> = {
  tickets: TicketSchema,
  ticket_comments: TicketCommentSchema,
  users: UserSchema,
  organizations: OrganizationSchema,
  groups: GroupSchema,
  brands: BrandSchema,
  ticket_fields: TicketFieldSchema,
  ticket_forms: TicketFormSchema,
  custom_statuses: CustomStatusSchema,
  survey_responses: SurveyResponseSchema,
  csat_surveys: CsatSurveySchema,
};
