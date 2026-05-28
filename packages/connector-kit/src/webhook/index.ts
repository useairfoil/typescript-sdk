import type * as Schema from "effect/Schema";

import type { Route } from "./types";

export { router } from "./server";
export type { Route } from "./types";

export const defineRoute = <S extends Schema.Schema<any>>(definition: Route<S>): Route<S> =>
  definition;
