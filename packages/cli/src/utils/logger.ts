import { encode } from "@toon-format/toon";
import { Cause, Console, Effect, Formatter, Layer, Logger, Result, Runtime, Schema } from "effect";

import { Output } from "./options";

const decodeJson = Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Unknown));

export type OutputFormat = "default" | "json";

export const formatStructured = (value: unknown, output: OutputFormat) => {
  const json = Formatter.formatJson(value);

  return output === "json" ? json : encode(decodeJson(json));
};

const messageValue = (message: unknown) =>
  Array.isArray(message) && message.length === 1 ? message[0] : message;

const structuredLogger = (output: OutputFormat) =>
  Logger.make<unknown, string>(({ message }) =>
    formatStructured(messageValue(message), output),
  ).pipe(Logger.withConsoleLog);

// Errors are reported after the command ends, when its flags are gone. Keep the format here.
let errorFormat: OutputFormat = "default";

export const OutputLogger = Layer.unwrap(
  Effect.map(Output, (output) => {
    errorFormat = output;

    return Logger.layer([structuredLogger(output)]);
  }),
);

// Turns an error and its causes into plain JSON, so we do not walk the chain ourselves.
const encodeError = Schema.encodeSync(Schema.Defect());
const encodeErrorWithStack = Schema.encodeSync(Schema.Defect({ includeStack: true }));

/**
 * Prints a failed command as `error: message: ... cause: ...` instead of the stack dump
 * `runMain` prints by default.
 *
 * Says nothing about Ctrl+C, or about errors the CLI already printed itself.
 */
export const reportError = (cause: Cause.Cause<unknown>) => {
  if (Cause.hasInterruptsOnly(cause)) return Effect.void;

  const error = Cause.squash(cause);

  if (!Runtime.getErrorReported(error)) return Effect.void;

  // Only an unexpected defect is worth a stack. A failure is explained by its message chain.
  const defect = Cause.findDefect(cause);
  const stack =
    Result.isSuccess(defect) && defect.success instanceof Error ? defect.success.stack : undefined;

  if (errorFormat === "json") {
    const encode = stack === undefined ? encodeError : encodeErrorWithStack;

    return Console.error(formatStructured({ error: encode(error) }, "json"));
  }

  // Toon has no multi-line string, so the stack only reads well under the block.
  const block = formatStructured({ error: encodeError(error) }, "default");

  return Console.error(stack === undefined ? block : `${block}\n\n${stack}`);
};
