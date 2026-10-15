import type { ConnectorError } from "@useairfoil/connector-kit";

import { Cache, Duration, Effect, Exit } from "effect";

import type { SalesforceClientService } from "../client/client";

import {
  type DescribeField,
  DescribeSchema,
  GlobalDescribeSchema,
  type GlobalObjectSchema,
} from "../schemas/api";

// New fields and objects show up after this.
const describeTtl = Duration.hours(1);

// Compound fields repeat their parts, and binary fields are links to files.
const skippedTypes = new Set(["address", "location", "base64"]);
// These say when the connector's user last saw the record, not about the record.
const skippedFields = new Set(["LastViewedDate", "LastReferencedDate"]);

export type ObjectInfo = {
  readonly replicateable: boolean;
  readonly hasIsDeleted: boolean;
  readonly fields: ReadonlyArray<DescribeField>;
  /** Fields to read into rows. */
  readonly fieldNames: ReadonlyArray<string>;
};

export type GlobalObject = typeof GlobalObjectSchema.Type;

export type Describer = {
  readonly describe: (object: string) => Effect.Effect<ObjectInfo, ConnectorError>;
  /** Drops a cached describe, so the next read uses the new field list. */
  readonly invalidate: (object: string) => Effect.Effect<void>;
  readonly objects: Effect.Effect<ReadonlyArray<GlobalObject>, ConnectorError>;
};

export const makeDescriber = (client: SalesforceClientService): Effect.Effect<Describer> =>
  Effect.gen(function* () {
    const cache = yield* Cache.makeWith(
      (object: string) =>
        client.get(DescribeSchema, `/sobjects/${object}/describe`).pipe(
          Effect.map(
            ({ body }): ObjectInfo => ({
              replicateable: body.replicateable,
              hasIsDeleted: body.fields.some((field) => field.name === "IsDeleted"),
              fields: body.fields,
              fieldNames: body.fields
                .filter((field) => !skippedTypes.has(field.type) && !skippedFields.has(field.name))
                .map((field) => field.name),
            }),
          ),
        ),
      {
        capacity: 10_000,
        timeToLive: (exit) => (Exit.isSuccess(exit) ? describeTtl : Duration.zero),
      },
    );
    const objects = yield* client.get(GlobalDescribeSchema, "/sobjects").pipe(
      Effect.map(({ body }) => body.sobjects),
      Effect.cachedWithTTL((exit) => (Exit.isSuccess(exit) ? describeTtl : Duration.zero)),
    );

    return {
      describe: (object) => Cache.get(cache, object),
      invalidate: (object) => Cache.invalidate(cache, object),
      objects,
    };
  });
