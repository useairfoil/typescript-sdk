import * as p from "@clack/prompts";
import { Effect } from "effect";

export const handleCliError = (fallbackMessage: string) => (error: unknown) =>
  Effect.sync(() => {
    p.cancel(error instanceof Error ? error.message : fallbackMessage);
  }).pipe(Effect.andThen(Effect.fail(error instanceof Error ? error : new Error(fallbackMessage))));
