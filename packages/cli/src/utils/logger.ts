import { encode } from "@toon-format/toon";
import { Effect, Formatter, Layer, Logger, Schema } from "effect";

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

export const OutputLogger = Layer.unwrap(
  Effect.map(Output, (output) => Logger.layer([structuredLogger(output)])),
);
