import type { ConnectorError } from "@useairfoil/connector-kit";

import { Effect, type Schema } from "effect";

import type { HubSpotClientService } from "../../client/client";
import type { CrmSpec } from "./spec";

import { makeReader } from "./read";
import { crmBackfill, crmChanges, crmCheck } from "./sources";
import { crmWebhook } from "./webhook";

/** What `Resource.entity` takes for a CRM object. */
export type CrmEntity<Row extends object> = {
  readonly name: string;
  readonly rowSchema: Schema.Decoder<Row>;
  readonly key: "id";
  readonly version: "version";
  readonly check: Effect.Effect<void, ConnectorError>;
  readonly backfill: ReturnType<typeof crmBackfill<Row>>;
  readonly changes: ReturnType<typeof crmChanges<Row>>;
  readonly webhook: ReturnType<typeof crmWebhook<Row>>;
};

export const crmEntity = <Row extends object>(
  client: HubSpotClientService,
  spec: CrmSpec<Row>,
): Effect.Effect<CrmEntity<Row>> =>
  makeReader(client, spec).pipe(
    Effect.map((reader) => ({
      name: spec.name,
      rowSchema: spec.rowSchema,
      key: "id",
      version: "version",
      check: crmCheck(client, reader, spec),
      backfill: crmBackfill(client, reader, spec),
      changes: crmChanges(client, reader, spec),
      webhook: crmWebhook(reader, spec),
    })),
  );
