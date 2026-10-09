import { Resource } from "@useairfoil/connector-kit";
import { Duration, Effect } from "effect";

import type { HubSpotClientService } from "../client/client";

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
} from "../schemas/crm";
import { crmEntity } from "./crm/resource";
import { companies, contacts, deals, tickets } from "./crm/spec";

// Activities often outnumber contacts 10 to 1, so they are read again less often.
const daily = Duration.days(1);
const weekly = Duration.weeks(1);

const core = {
  lastModified: "hs_lastmodifieddate",
  listsDeleted: true,
  refreshInterval: daily,
};

const activity = {
  lastModified: "hs_lastmodifieddate",
  associations: [companies, contacts, deals, tickets],
  listsDeleted: true,
  refreshInterval: weekly,
};

/** CRM object resources by the object type ID in webhook events. */
export const makeCrmResources = (client: HubSpotClientService) =>
  Effect.all({
    "0-1": crmEntity(client, {
      ...core,
      name: "contacts",
      lastModified: "lastmodifieddate",
      associations: [companies],
      rowSchema: ContactSchema,
    }).pipe(Effect.map((input) => Resource.entity(input))),
    "0-2": crmEntity(client, {
      ...core,
      name: "companies",
      associations: [],
      rowSchema: CompanySchema,
    }).pipe(Effect.map((input) => Resource.entity(input))),
    "0-3": crmEntity(client, {
      ...core,
      name: "deals",
      associations: [companies, contacts],
      rowSchema: DealSchema,
    }).pipe(Effect.map((input) => Resource.entity(input))),
    "0-5": crmEntity(client, {
      ...core,
      name: "tickets",
      associations: [companies, contacts, deals],
      rowSchema: TicketSchema,
    }).pipe(Effect.map((input) => Resource.entity(input))),
    "0-48": crmEntity(client, { ...activity, name: "calls", rowSchema: CallSchema }).pipe(
      Effect.map((input) => Resource.entity(input)),
    ),
    // A deleted email is gone right away, so the archived list is always empty.
    "0-49": crmEntity(client, {
      ...activity,
      name: "emails",
      listsDeleted: false,
      rowSchema: EmailSchema,
    }).pipe(Effect.map((input) => Resource.entity(input))),
    // HubSpot rejects listing deleted meetings.
    "0-47": crmEntity(client, {
      ...activity,
      name: "meetings",
      listsDeleted: false,
      rowSchema: MeetingSchema,
    }).pipe(Effect.map((input) => Resource.entity(input))),
    "0-46": crmEntity(client, { ...activity, name: "notes", rowSchema: NoteSchema }).pipe(
      Effect.map((input) => Resource.entity(input)),
    ),
    "0-27": crmEntity(client, { ...activity, name: "tasks", rowSchema: TaskSchema }).pipe(
      Effect.map((input) => Resource.entity(input)),
    ),
    "0-8": crmEntity(client, {
      ...activity,
      name: "line_items",
      associations: [deals],
      rowSchema: LineItemSchema,
    }).pipe(Effect.map((input) => Resource.entity(input))),
    "0-7": crmEntity(client, {
      ...activity,
      name: "products",
      associations: [],
      rowSchema: ProductSchema,
    }).pipe(Effect.map((input) => Resource.entity(input))),
  });
