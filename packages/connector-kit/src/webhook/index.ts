import type * as Schema from "effect/Schema";

import type { WebhookRoute } from "./types";

export { buildWebhookRouter } from "./server";
export type { WebhookRoute } from "./types";

export const route = <S extends Schema.Schema<any>>(definition: WebhookRoute<S>): WebhookRoute<S> =>
  definition;
