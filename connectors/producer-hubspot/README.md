# HubSpot producer

Syncs HubSpot contacts, companies, deals, tickets, calls, emails, meetings,
notes, tasks, line items, products, owners, and pipelines from one HubSpot
account. It backfills each resource and polls every 5 minutes. With an app
client secret, it also takes webhooks at `POST /webhooks/hubspot`.

## Config

| Variable                | Required | Default |
| ----------------------- | -------- | ------- |
| `HUBSPOT_ACCESS_TOKEN`  | yes      | none    |
| `HUBSPOT_CLIENT_SECRET` | no       | none    |

Without `HUBSPOT_CLIENT_SECRET`, webhooks are off and every change comes from
polling.

## Setup

For polling only, create a service key under **Development → Keys → Service
keys** with these read scopes:

- `crm.objects.contacts.read`, `crm.schemas.contacts.read`
- `crm.objects.companies.read`, `crm.schemas.companies.read`
- `crm.objects.deals.read`, `crm.schemas.deals.read`
- `crm.objects.tickets.read`, `crm.schemas.tickets.read`
- `crm.objects.line_items.read`, `crm.schemas.line_items.read`
- `crm.objects.products.read`
- `crm.objects.owners.read`
- `sales-email-read`

Use the key as `HUBSPOT_ACCESS_TOKEN`.

Service keys can't receive webhooks. For webhooks, upload the app in
`hubspot-app/` with the HubSpot CLI instead:

1. Set `targetUrl` in `hubspot-app/src/app/webhooks/webhooks-hsmeta.json` to
   `<connector>/webhooks/hubspot`.
2. Run `hs account auth`, then `hs project upload` from `hubspot-app/`.
3. Install the app from **Development → Projects → airfoil-connector →
   Distribution**.
4. Use the access token from the Distribution tab as `HUBSPOT_ACCESS_TOKEN` and
   the client secret from the Auth tab as `HUBSPOT_CLIENT_SECRET`.

One token reads one account, so run one connector per account.

## API version

The connector uses the `2026-09` API paths, such as
`/crm/objects/2026-09/contacts`.

## Data

- CRM tables keep every non-empty property in `properties`, by internal name,
  as strings. New custom properties show up on their own. Sensitive properties
  are left out.
- Contacts, deals, tickets, activities, and line items have lists of associated
  record IDs.
- A deleted record gets `_deleted`. So do records merged into another one.
- Owners and pipelines stay with `archived = true` when removed.
- Contacts, emails, calls, meetings, and notes hold customer data such as
  names, emails, phone numbers, message bodies, and meeting notes. Treat these
  tables as customer data.

## Limits

- Calculated properties and association lists can be a day old, or a week for
  activities, line items, and products. Webhooks bring association changes
  right away.
- Without webhooks, these deletes are missed: GDPR deletes, deleted emails, and
  deleted meetings. HubSpot can't list them.
- A record restored from the recycle bin comes back on its next read: a
  webhook, a search hit, or the full re-read.
- Searches, polls of deleted records, and full re-reads share the account's
  daily API limit with its other apps.

## Local development

```bash
cd connectors/producer-hubspot
pnpm sandbox
```

To record VCR, put a test account's service key in `.env`, delete
`test/__cassettes__/api.vcr.test.cassette`, and run `pnpm test:ci`. Recording
takes a few minutes. Check the new cassette for personal data before committing
it.

`pnpm start` runs the hosted connector. It needs the Wings and PostgreSQL
variables from the Connector Kit README.
