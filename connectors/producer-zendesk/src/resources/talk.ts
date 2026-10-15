import { Resource } from "@useairfoil/connector-kit";
import { DateTime, Effect } from "effect";

import type { ZendeskClientService } from "../client/client";

import { type TalkLine, TalkLineObjectSchema, TalkLineSchema } from "../schemas/talk";
import { listAll, listSources } from "./pages";

export const makeTalkLines = (client: ZendeskClientService) =>
  Resource.entity({
    name: "talk_lines",
    rowSchema: TalkLineSchema,
    version: "version",
    ...listSources(
      Effect.gen(function* () {
        // It has no cursor paging. Accounts have a few lines.
        const lines = yield* listAll(client, {
          path: "/channels/voice/lines",
          key: "lines",
          item: TalkLineObjectSchema,
          params: {},
        });
        const version = yield* DateTime.nowAsDate;
        return lines.map(
          (line): TalkLine => ({
            ...line,
            version,
            brand_id: line.brand_id ?? null,
            number: line.number ?? null,
            display_number: line.display_number ?? null,
            country_code: line.country_code ?? null,
            toll_free: line.toll_free ?? null,
          }),
        );
      }),
    ),
  });
