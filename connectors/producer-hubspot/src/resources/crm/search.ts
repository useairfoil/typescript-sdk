import type { ConnectorError } from "@useairfoil/connector-kit";

import { DateTime, Duration, Effect, Option, Schema } from "effect";

import type { HubSpotClientService } from "../../client/client";
import type { CrmSpec } from "./spec";

import { SearchPageSchema } from "../../schemas/api";
import { objectsPath } from "./read";

const pageSize = 200;

/**
 * A search over `[from, until]` by last-modified time, oldest first. Each page
 * starts at the last row's time, because result offsets shift when a record
 * leaves the window. With `tie`, a whole page shares `from`, and those records
 * are read by ID.
 */
export const SearchPassSchema = Schema.Struct({
  from: Schema.DateTimeUtcFromString,
  until: Schema.optional(Schema.DateTimeUtcFromString),
  tie: Schema.optional(Schema.Struct({ afterId: Schema.optional(Schema.String) })),
});

export type SearchPass = Schema.Schema.Type<typeof SearchPassSchema>;

/** A pass with a window end, so it has pages to read. */
export type StartedPass = SearchPass & { readonly until: DateTime.Utc };

type SearchStep = {
  readonly ids: ReadonlyArray<string>;
  readonly pass: SearchPass;
};

const millis = (time: DateTime.Utc) => String(DateTime.toEpochMillis(time));

/** Starts an idle pass when `now - lag` is past `from`. A running pass goes on. */
export const startPass = (
  pass: SearchPass,
  now: DateTime.Utc,
  lag: Duration.Duration,
): SearchPass => {
  if (pass.until !== undefined) return pass;
  const until = DateTime.subtractDuration(now, lag);
  return DateTime.isGreaterThan(until, pass.from) ? { ...pass, until } : pass;
};

/** Reads one page of a started pass and returns where it goes on. */
export const searchStep = <Row extends object>(
  client: HubSpotClientService,
  spec: CrmSpec<Row>,
  pass: StartedPass,
): Effect.Effect<SearchStep, ConnectorError> =>
  Effect.gen(function* () {
    const path = `${objectsPath(spec.name)}/search`;

    if (pass.tie !== undefined) {
      const afterId = pass.tie.afterId;
      const { body } = yield* client.post(SearchPageSchema, path, {
        filterGroups: [
          {
            filters: [
              { propertyName: spec.lastModified, operator: "EQ", value: millis(pass.from) },
              ...(afterId === undefined
                ? []
                : [{ propertyName: "hs_object_id", operator: "GT", value: afterId }]),
            ],
          },
        ],
        sorts: [{ propertyName: "hs_object_id", direction: "ASCENDING" }],
        properties: [spec.lastModified],
        limit: pageSize,
      });
      const ids = body.results.map((item) => item.id);
      const lastId = ids.at(-1);
      // Done with this time. HubSpot times are in whole milliseconds.
      if (body.paging === undefined || lastId === undefined) {
        return {
          ids,
          pass: {
            from: DateTime.addDuration(pass.from, Duration.millis(1)),
            until: pass.until,
          },
        };
      }
      return { ids, pass: { ...pass, tie: { afterId: lastId } } };
    }

    const { body } = yield* client.post(SearchPageSchema, path, {
      filterGroups: [
        {
          filters: [
            {
              propertyName: spec.lastModified,
              operator: "BETWEEN",
              value: millis(pass.from),
              highValue: millis(pass.until),
            },
          ],
        },
      ],
      sorts: [{ propertyName: spec.lastModified, direction: "ASCENDING" }],
      properties: [spec.lastModified],
      limit: pageSize,
    });
    const ids = body.results.map((item) => item.id);

    if (body.paging === undefined) {
      return { ids, pass: { from: pass.until } };
    }
    // Rows at the last row's time come again on the next page.
    const last = Option.flatMap(
      Option.fromNullishOr(body.results.at(-1)?.properties[spec.lastModified]),
      DateTime.make,
    );
    if (Option.isSome(last) && DateTime.isGreaterThan(last.value, pass.from)) {
      return { ids, pass: { from: DateTime.toUtc(last.value), until: pass.until } };
    }
    return { ids, pass: { from: pass.from, until: pass.until, tie: {} } };
  });
