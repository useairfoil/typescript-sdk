# Salesforce producer

Syncs Salesforce records from one org: standard objects, custom objects, field
history, and field definitions. It backfills each table, then polls business
objects every 10 minutes and setup objects every hour. Salesforce has no signed
webhooks, so there are none.

| Resource                                                                                                                                                                                                                                                                    | What                                     |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `accounts`, `account_contact_relations`, `account_team_members`, `contacts`, `leads`, `opportunities`, `opportunity_line_items`, `opportunity_contact_roles`, `opportunity_competitors`, `opportunity_team_members`, `opportunity_splits`, `partners`, `forecasting_quotas` | Sales                                    |
| `quotes`, `quote_line_items`, `contracts`, `contract_contact_roles`, `orders`, `order_items`                                                                                                                                                                                | Quotes and orders                        |
| `products`, `pricebooks`, `pricebook_entries`, `assets`, `asset_relationships`                                                                                                                                                                                              | Catalog and assets                       |
| `campaigns`, `campaign_members`, `campaign_member_statuses`, `individuals`, `contact_point_emails`, `contact_point_phones`                                                                                                                                                  | Marketing                                |
| `cases`, `case_comments`, `case_contact_roles`, `case_team_members`, `entitlements`, `service_contracts`, `contract_line_items`, `solutions`, `email_messages`, `email_message_relations`, `live_chat_transcripts`, `messaging_sessions`, `macros`, `quick_texts`           | Service                                  |
| `work_orders`, `work_order_line_items`, `service_appointments`, `service_resources`, `service_territories`, `assigned_resources`, `resource_absences`, `locations`, `product_items`                                                                                         | Field Service                            |
| `tasks`, `task_relations`, `events`, `event_relations`, `notes`, `attachments`, `feed_items`, `feed_comments`, `topics`, `topic_assignments`                                                                                                                                | Activities                               |
| `account_history`, `contact_history`, `lead_history`, `case_history`, `opportunity_history`, `opportunity_field_history`                                                                                                                                                    | Field history                            |
| `users`, `user_roles`, `profiles`, `permission_sets`, `permission_set_assignments`, `groups`, `group_members`, `collaboration_groups`, `collaboration_group_members`, `record_types`, `business_hours`, `holidays`, `periods`, `organization`, `folders`, `documents`       | Users and setup                          |
| `duplicate_record_sets`, `duplicate_record_items`                                                                                                                                                                                                                           | Duplicate rules                          |
| `custom_objects`                                                                                                                                                                                                                                                            | Records of every custom object (`*__c`)  |
| `object_fields`                                                                                                                                                                                                                                                             | Field definitions, to name `fields` keys |

## Config

| Variable                   | Required | Default |
| -------------------------- | -------- | ------- |
| `SALESFORCE_DOMAIN`        | yes      | none    |
| `SALESFORCE_CLIENT_ID`     | yes      | none    |
| `SALESFORCE_CLIENT_SECRET` | yes      | none    |

`SALESFORCE_DOMAIN` is the org's My Domain host, such as
`acme.my.salesforce.com`. Sandboxes work too.

## Setup

1. Pick the user the connector runs as. A user with the Salesforce Integration
   license works. Give it API Enabled, read access to the synced objects, and
   View All Data. Without View All Data, records outside its sharing are
   missed.
2. In Setup, open **External Client App Manager → New External Client App**.
   Turn on OAuth with the `api` scope and **Enable Client Credentials Flow**.
   The callback URL isn't used.
3. In the app's **Policies → OAuth Policies**, turn on the client credentials
   flow and set **Run As** to the user from step 1.
4. Under **Settings → OAuth Settings → Consumer Key and Secret**, copy the key
   and secret to `SALESFORCE_CLIENT_ID` and `SALESFORCE_CLIENT_SECRET`.

One app and domain read one org, so run one connector per org.

## API version

The connector uses REST API `v68.0` (Winter '27).

## Data

- Object tables keep every non-null field the user can read in `fields`, by API
  name, as strings: text as is, numbers and booleans as JSON text, and dates as
  Salesforce sends them. New custom fields show up on their own.
  `object_fields` has each field's label, type, and picklist values.
- Address and location fields are left out, because their parts (such as
  `BillingCity`) are fields too. So are binary fields, such as attachment
  bodies.
- `created_at` is `CreatedDate` and `updated_at` is `SystemModstamp`. Both are
  null on objects without them, such as history objects.
- `custom_objects` holds every custom object. `object` says which, such as
  `Invoice__c`.
- A deleted or merged-away record gets `_deleted`. A restored record comes
  back.
- Contacts, leads, users, individuals, contact points, cases, emails, chat and
  messaging transcripts, feed items, notes, tasks, and events hold names,
  emails, phone numbers, addresses, and message bodies. Treat them as customer
  data.

## Limits

- Salesforce lists changes for the last 30 days and deletes for the last 15.
  A connector stopped for more than 15 days fails, and those tables need a new
  backfill.
- Formula fields that read other records only change in a row when the record
  itself changes.
- `permission_sets`, `permission_set_assignments`, and `collaboration_groups`
  can't be replicated, so they're read in full every hour, and removed rows
  stay.
- An org without a feature, such as Quotes or Field Service, or a user without
  access, leaves that table in error. The other tables keep syncing.
- Every table costs at least 2 API calls per poll. With every table on, that's
  about 23,000 calls a day. A Developer Edition org has 15,000, so turn on only
  the tables you need there.
