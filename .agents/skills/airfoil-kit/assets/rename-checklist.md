# rename-checklist

After copying `templates/producer-template/` to
`connectors/producer-<service>/`, apply every find-and-replace below
before writing any new code. Missing a rename is the most common reason
tests or builds fail.

Replace `<service>`, `<Service>`, `<SERVICE>` with the three casing
variants of the target service name:

- `<service>` — lowercase kebab (e.g. `stripe`, `shopify-admin`).
- `<Service>` — PascalCase (e.g. `Stripe`, `ShopifyAdmin`).
- `<SERVICE>` — SCREAMING_SNAKE (e.g. `STRIPE`, `SHOPIFY_ADMIN`).

## File-name renames

The copy target already renamed the directory. Check inside the new
package for any file that still references `template`:

```bash
# Should return no results after rename pass
rg -l "template" connectors/producer-<service> --glob '!**/__cassettes__' --glob '!**/dist' --glob '!**/node_modules'
```

## Identifier map

| Find                                              | Replace with                                        |
| ------------------------------------------------- | --------------------------------------------------- |
| `producer-template`                               | `producer-<service>`                                |
| `@useairfoil/producer-template`                   | `@useairfoil/producer-<service>`                    |
| `TEMPLATE_` (env prefix)                          | `<SERVICE>_`                                        |
| `TemplateApiClient`                               | `<Service>ApiClient`                                |
| API raw-config layer                              | `layer`                                             |
| `TemplateApiClientService`                        | `<Service>ApiClientService`                         |
| `TemplateListPage`                                | `<Service>ListPage`                                 |
| `TemplateConfig` (type)                           | `<Service>Config`                                   |
| `TemplateConfigConfig` (Config value)             | `<Service>ConfigConfig`                             |
| `TemplateConnector` (service tag)                 | `<Service>Connector`                                |
| Config-decoded layers                             | `layerConfig(config)`                               |
| `TemplateConnectorRuntime`                        | `<Service>ConnectorRuntime`                         |
| Connector constructor                             | `make`                                              |
| `Template` (any other identifier prefix)          | `<Service>`                                         |
| `template` (lowercase in strings / URNs)          | `<service>`                                         |
| `@useairfoil/producer-template/TemplateApiClient` | `@useairfoil/producer-<service>/<Service>ApiClient` |
| `@useairfoil/producer-template/TemplateConnector` | `@useairfoil/producer-<service>/<Service>Connector` |
| `"producer-template"` (connector name string)     | `"producer-<service>"`                              |
| `"/webhooks/template"` (route path)               | `"/webhooks/<service>"`                             |

Env vars from `.env.example`:

| Find                      | Replace with                                             |
| ------------------------- | -------------------------------------------------------- |
| `TEMPLATE_API_BASE_URL`   | `<SERVICE>_API_BASE_URL`                                 |
| `TEMPLATE_API_TOKEN`      | `<SERVICE>_API_TOKEN` (or whatever the service calls it) |
| `TEMPLATE_WEBHOOK_PORT`   | `<SERVICE>_WEBHOOK_PORT`                                 |
| `TEMPLATE_WEBHOOK_SECRET` | `<SERVICE>_WEBHOOK_SECRET`                               |

## Entity-name renames

The template ships one toy entity `posts`. For your v1 entity list:

| Find                                            | Replace with           |
| ----------------------------------------------- | ---------------------- |
| `posts` (entity name in `defineEntity`)         | `<your-first-entity>`  |
| `PostSchema`                                    | `<YourEntity>Schema`   |
| `Post` (type alias)                             | `<YourEntity>`         |
| `"/posts"` (API path)                           | the real endpoint path |
| `post.created` / `post.updated` (webhook types) | the real event types   |

Add further entities by duplicating the `makeEntityStreams` + `defineEntity`
block.

## URLs and base paths

- `https://jsonplaceholder.typicode.com` → the real API base URL.
- If the real base URL depends on sandbox vs prod, set the default in
  `Config.withDefault(...)` to the sandbox URL.

## Cassettes

Delete the copied cassette before re-recording against the real API:

```bash
rm -rf connectors/producer-<service>/test/__cassettes__
```

The next `pnpm run test` run in `mode: "record"` will
recreate it.

## README

Rewrite `connectors/producer-<service>/README.md`:

- Drop every JSONPlaceholder reference.
- Document the current public exports, real API entities, auth, runtime
  wiring, base URLs, and env vars.
- List known limitations specific to the target (rate limits, missing
  historical data, sandbox quirks).

## Verification

After all renames, these should return zero hits:

```bash
rg -n "template|TEMPLATE|Template" connectors/producer-<service> \
  --glob '!**/__cassettes__' --glob '!**/dist' --glob '!**/node_modules'

rg -n "jsonplaceholder" connectors/producer-<service> \
  --glob '!**/__cassettes__'
```

If either has hits, investigate before moving on. A stray identifier
will break compile or (worse) silently run against the template toy
endpoint.

## Global search/replace shortcut

In most editors, a case-preserving search-and-replace across the new
package handles 95% of the work:

```
Find: Template
Replace: <Service>
Case: preserve (Template→<Service>, template→<service>, TEMPLATE→<SERVICE>)
Scope: connectors/producer-<service>/
```

Then manually verify the remaining hits against the identifier table
above.
