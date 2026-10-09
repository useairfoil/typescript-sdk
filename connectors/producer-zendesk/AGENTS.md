# Zendesk producer

## Current scope

- Resources: `tickets`, `ticket_comments`, `users`, `organizations`,
  `groups`, `brands`, `ticket_fields`, `ticket_forms`, `custom_statuses`,
  `survey_responses`, `csat_surveys`
- Auth: one OAuth client with the client credentials grant, for one account
- Changes: every 5 minutes for the exports, every hour for the rest
- Webhooks: none

## Zendesk rules

- Every request goes through `src/client`, so VCR records it.
- Incremental exports allow 10 calls a minute, shared with every other tool on
  the account. The users export has its own 20. Their limiters ignore headers,
  or they would pick up the account limit.
- A `401` drops the cached token and tries once more.
- Tokens ask for `expires_in`. Without it, older clients make tokens that
  never expire and pile up in the account.
- Use the cursor exports where they exist (tickets, users). Organizations and
  ticket events only have time-based ones.
- Zendesk holds back the last minute. The first changes run starts a minute
  before the cutoff.
- Lists use `page[size]` cursor paging. `custom_statuses` has none. The survey
  APIs allow at most 50 a page.

Ticket versions use `generated_timestamp`: `updated_at` misses system updates.
Comments use the ticket event time. Survey responses use the latest answer's
`updated_at`. Other resources use `updated_at`.

Deleted tickets have `status: "deleted"` and can be restored, so ticket rows
send `_deleted: false`. Users (`active: false`) and organizations
(`deleted_at`) can't be restored, so their other rows leave it out. The small
lists drop deleted items, so they have no `_deleted`.

A comment event shows the comment as it is now. After a comment or attachment
redaction, read the ticket's comments again. Skip `404` for deleted tickets.
Privacy changes have no child events and are not caught.

Survey answers can change for 28 days. The list filters by when the survey was
sent, so read from 29 days before the saved cursor, not the current time.
Skip responses with no answers.

A column can't go back to null. Before adding a column Zendesk often clears,
note it in the README.

Record VCR against a test account only. The VCR test builds the connector once,
because a second token request would replay the redacted token.
