import { Resource } from "@useairfoil/connector-kit";
import { Duration } from "effect";

import type { SalesforceClientService } from "../client/client";
import type { ObjectSpec } from "../manifest";
import type { Describer } from "./describe";

import { objectSchema } from "../schemas/objects";
import { objectBackfill, objectChanges, objectCheck } from "./sources";

export const changesInterval = Duration.minutes(10);
const setupInterval = Duration.hours(1);

export const objectResource = (
  client: SalesforceClientService,
  describer: Describer,
  spec: ObjectSpec,
) =>
  Resource.entity({
    name: spec.name,
    rowSchema: objectSchema(spec.object),
    version: "version",

    check: objectCheck(describer, spec.object),
    backfill: objectBackfill(client, describer, spec.object),
    changes: objectChanges(client, describer, spec.object, {
      interval: spec.setup === true ? setupInterval : changesInterval,
      deletes: spec.deletes !== false,
    }),
  });
