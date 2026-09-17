# Producer template

This is the reference implementation for a producer connector. Developers and
coding agents can copy it or use it while building a real connector.

It uses JSONPlaceholder and has one `posts` resource, so it runs without any
provider account. It is not meant to be deployed as-is.

## What to replace

Replace the package name, manifest, config, API client, schemas, resources,
webhook verification, and tests. Keep the sandbox and hosted runtime wiring
unless the connector needs something different.

## Local development

```bash
cd templates/producer-template
pnpm sandbox
```

Use `pnpm start` for the hosted runtime. It needs the Wings and PostgreSQL
variables from the Connector Kit README.

## Configuration

| Variable                  | Required | Default                                |
| ------------------------- | -------- | -------------------------------------- |
| `TEMPLATE_API_BASE_URL`   | no       | `https://jsonplaceholder.typicode.com` |
| `TEMPLATE_API_TOKEN`      | no       | none                                   |
| `TEMPLATE_WEBHOOK_SECRET` | no       | none                                   |
| `AIRFOIL_HTTP_PORT`       | no       | `8080`                                 |

The webhook is `POST /webhooks/template`. Its signature check accepts every
request because JSONPlaceholder has no webhooks. A real connector must replace
this check.
