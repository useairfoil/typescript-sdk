export * as HubSpotClient from "./client/client";
export * as HubSpotConnector from "./connector";
export { manifest } from "./manifest";
export type {
  Call,
  Company,
  Contact,
  Deal,
  Email,
  LineItem,
  Meeting,
  Note,
  Product,
  Task,
  Ticket,
} from "./schemas/crm";
export {
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
export type { Owner } from "./schemas/owners";
export { OwnerSchema } from "./schemas/owners";
export type { Pipeline } from "./schemas/pipelines";
export { PipelineSchema } from "./schemas/pipelines";
export { webhookPath } from "./webhook/route";
