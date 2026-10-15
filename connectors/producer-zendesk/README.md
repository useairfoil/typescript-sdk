# Zendesk producer

Syncs tickets, comments, field history, metric events, users, organizations,
satisfaction ratings and surveys, Help Center articles and community posts,
Talk lines, and the lists that name their IDs from one Zendesk account. It
backfills each resource and polls for changes. There are no webhooks.

## Config

| Variable                | Required | Default |
| ----------------------- | -------- | ------- |
| `ZENDESK_SUBDOMAIN`     | yes      | none    |
| `ZENDESK_CLIENT_ID`     | yes      | none    |
| `ZENDESK_CLIENT_SECRET` | yes      | none    |

## Setup

As an admin, add an OAuth client in Admin Center under
Apps and integrations > APIs > OAuth clients:

- Client kind: Confidential.
- Scopes: leave empty, or allow `read`.
- No redirect URL is needed.

Use the Identifier as `ZENDESK_CLIENT_ID` and the secret as
`ZENDESK_CLIENT_SECRET`. Use `acme` for `acme.zendesk.com`; the full address
also works.

The token uses the permissions of the admin who made the client.

## Data

- `tickets.metrics` holds reply, wait, and resolution times. `custom_fields`
  maps field IDs to values, and `ticket_fields` names them.
- `ticket_comments` includes internal notes (`public` is false). It has the
  text, not attachment files.
- Deleted tickets, users, and organizations get `_deleted`. Restored tickets
  come back.
- Groups, brands, ticket fields, forms, and statuses keep deleted items, so
  older tickets still have their names. So do the other lists, articles, and
  Talk lines. Removed group and organization memberships get `_deleted`.
- `ticket_field_history` has one row per changed field. Custom fields use
  their ID.
- `satisfaction_ratings` holds legacy CSAT ratings. A new score is a new row.
- `survey_responses` holds CSAT answers. `csat_surveys` names the questions
  and options. Both need the new CSAT, on Support Professional or Suite Growth
  and up. Unanswered surveys are skipped.
- Tables hold names, emails, and ticket text. Treat them as confidential.

## Limits

- Incremental exports share a limit of 10 calls a minute per account, or 30
  with the High Volume add-on. Large comment backfills can be slow.
- `ticket_comments` and `ticket_field_history` each read the ticket events
  export, so both count toward that limit.
- Exports are polled every 5 minutes. Zendesk leaves out the latest minute.
- A comment made private later stays public in `ticket_comments`. Zendesk's
  event for it has no details. A redacted comment or attachment is read again.

## Local development

```bash
cd connectors/producer-zendesk
pnpm sandbox
```

`pnpm start` runs the hosted connector. It needs the Wings and PostgreSQL
variables from the [Connector Kit README](../../packages/connector-kit/README.md).
