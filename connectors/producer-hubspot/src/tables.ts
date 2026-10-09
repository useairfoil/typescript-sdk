import type { Schema } from "effect";

import {
  CallSchema,
  CompanySchema,
  ContactSchema,
  DealSchema,
  EmailSchema,
  LineItemSchema,
  MeetingSchema,
  NoteSchema,
  ProductSchema,
  TaskSchema,
  TicketSchema,
} from "./schemas/crm";
import { OwnerSchema } from "./schemas/owners";
import { PipelineSchema } from "./schemas/pipelines";

export const tableSchemas: Readonly<Record<string, Schema.Top>> = {
  contacts: ContactSchema,
  companies: CompanySchema,
  deals: DealSchema,
  tickets: TicketSchema,
  calls: CallSchema,
  emails: EmailSchema,
  meetings: MeetingSchema,
  notes: NoteSchema,
  tasks: TaskSchema,
  line_items: LineItemSchema,
  products: ProductSchema,
  owners: OwnerSchema,
  pipelines: PipelineSchema,
};
