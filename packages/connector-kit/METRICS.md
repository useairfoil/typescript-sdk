# Connector Metrics And Status

Connector Kit emits standard metrics through Effect metrics. Production runtimes should use `Telemetry.layerOtlp()` with `OTEL_ENABLED=true`, `OTEL_EXPORTER_OTLP_ENDPOINT`, and optional `OTEL_EXPORTER_OTLP_HEADERS`. Local HTTP connector runtimes expose Prometheus text at `GET /metrics` by default; sandboxes can also merge `Telemetry.layerMetricsConsoleDump()` for periodic log output.

## Metrics

| Name                                        | Type            | Unit            | Attributes                                   |
| ------------------------------------------- | --------------- | --------------- | -------------------------------------------- |
| `airfoil_connector_entities_upserted_total` | counter         | mutations       | `connector`, `resource`, `source`            |
| `airfoil_connector_entities_deleted_total`  | counter         | mutations       | `connector`, `resource`, `source`            |
| `airfoil_connector_batches_total`           | counter         | batches         | `connector`, `resource`, `source`, `outcome` |
| `airfoil_connector_batch_size`              | histogram       | mutations/batch | `connector`, `resource`, `source`            |
| `airfoil_connector_publish_duration_ms`     | histogram timer | ms              | `connector`, `resource`, `source`            |
| `airfoil_connector_webhook_requests_total`  | counter         | requests        | `connector`, `path`, `outcome`               |
| `airfoil_connector_webhook_queue_depth`     | gauge           | batches         | `connector`                                  |
| `airfoil_connector_sync_state`              | gauge           | none            | `connector`, `resource`, `state`             |

Allowed `source` values are `backfill`, `changes`, and `webhook`. Batch `outcome` is `accepted`, `rejected`, or `error`. Webhook `outcome` is `ok`, `read_error`, `invalid_json`, `invalid_payload`, `rejected`, or `handler_error`. Sync `state` is `pending`, `backfilling`, `live`, or `error`.

Counters are activity since process start, not entity population. Use `increase()` or `rate()` and let Prometheus/OTLP consumers handle process restarts. `sum(upserts) - sum(deletes)` is connector activity, not the current table size; current totals belong in Wings/data-lake tables.

## Sync Status

HTTP connector runtimes expose `GET /status` by default. The response shape is decoded by `Status.StatusResponseSchema`:

```json
{
  "connector": "producer-example",
  "resources": [
    {
      "name": "products",
      "state": "live",
      "backfill": { "completed": true, "cutoff": "2026-01-01T00:00:00Z" },
      "changes": { "cursor": "2026-01-01T00:00:00Z" }
    }
  ]
}
```

No persisted state is `pending`; an incomplete backfill is `backfilling`; completed backfill or changes-only resources are `live`. Backfill/changes fetch, publish, or checkpoint failures set `error` with a structured `lastError`. The error includes `source`, `operation`, a stable `code` and SDK-owned `message`, plus `at`; it never contains the raw Effect cause. Backfill and changes errors are stored independently, and `/status` returns the newer outstanding error when both exist.

## Wings Contract

Import pure connector manifests from first-party producer packages, for example `@useairfoil/producer-polar/manifest`, through a registry. Use `Manifest.decodeConfig(manifest, input)` for canonical server-side validation and `Schema.toStandardSchemaV1(Manifest.configSchema(manifest))` for form resolvers. The schema accepts JSON-shaped config and browser form-shaped values, including stringified numbers/booleans and empty optional fields. Treat `field.required` and `field.default` independently: the canonical decoder treats an empty optional field as omitted and resolves its default, while an optional field without a default remains absent. Store user-facing connector config by manifest field `name`, then use `Manifest.toRuntimeDocument(...)` to map it to `field.runtimeKey` names. Hosted pods mount that complete JSON document read-only and point `AIRFOIL_CONFIG_PATH` at it; they do not receive one environment variable per user field. Secret rendering/redaction comes from `field.secret`, and existing secret values must not be returned to the browser. Platform-owned runtime config such as Wings host, namespace, tables, PostgreSQL bindings, webhook ports, and telemetry remains infrastructure-owned environment/Secret configuration outside the manifest document.

```ts
import * as Manifest from "@useairfoil/connector-kit/manifest";
import { manifest as polarManifest } from "@useairfoil/producer-polar/manifest";
import { Schema } from "effect";

const schema = Schema.toStandardSchemaV1(Manifest.configSchema(polarManifest));
const result = await schema["~standard"].validate(formValues);
```

Poll `GET /status` and decode with `Status.StatusResponseSchema`. Chart ingestion with `increase(airfoil_connector_entities_upserted_total[...])`, alert on `airfoil_connector_sync_state{state="error"} == 1`, and alert on non-`ok` webhook outcomes.
