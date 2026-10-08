import type { Duration, Schema } from "effect";

export type AssociationField = "company_ids" | "contact_ids" | "deal_ids" | "ticket_ids";

export type Association = {
  /** Object type in association paths, such as `companies`. */
  readonly to: string;
  /** Object type ID in webhook events, such as `0-2`. */
  readonly typeId: string;
  readonly field: AssociationField;
};

export const companies: Association = { to: "companies", typeId: "0-2", field: "company_ids" };
export const contacts: Association = { to: "contacts", typeId: "0-1", field: "contact_ids" };
export const deals: Association = { to: "deals", typeId: "0-3", field: "deal_ids" };
export const tickets: Association = { to: "tickets", typeId: "0-5", field: "ticket_ids" };

export type CrmSpec<Row extends object> = {
  /** Resource name and object type in API paths, such as `line_items`. */
  readonly name: string;
  /** Contacts use `lastmodifieddate`. The rest use `hs_lastmodifieddate`. */
  readonly lastModified: string;
  readonly associations: ReadonlyArray<Association>;
  /** Whether the archived list works. HubSpot rejects it for meetings. */
  readonly listsDeleted: boolean;
  /** How often every record is read again. */
  readonly refreshInterval: Duration.Duration;
  readonly rowSchema: Schema.Decoder<Row>;
};

export type DeleteRow = {
  readonly id: string;
  readonly version: Date;
  readonly _deleted: true;
};
