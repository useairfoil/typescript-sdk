import { DateTime, Effect } from "effect";

import type {
  ChangesFetch,
  ConnectorDefinition,
  Cursor as CursorType,
  PageFetch,
  ResourceDefinition,
  ResourceRequiredField,
  ResourceSchema,
} from "./types";

import { ConnectorError } from "../errors";

export const Connector = {
  define: <const Resources extends ReadonlyArray<ResourceDefinition>>(
    definition: ConnectorDefinition<Resources>,
  ) => definition,
};

export const Resource = {
  entity: <
    S extends ResourceSchema,
    Payload = never,
    R = never,
    const Name extends string = string,
    const Key extends ResourceRequiredField<S> = ResourceRequiredField<S>,
    const Version extends ResourceRequiredField<S> = ResourceRequiredField<S>,
  >(
    definition: ResourceDefinition<S, Payload, R, Name, Key, Version>,
  ): ResourceDefinition<S, Payload, R, Name, Key, Version> => definition,
};

export const Fetch = {
  page: <Row extends object = never, R = never>(definition: PageFetch<Row, R>) => definition,
  changes: <Row extends object = never, R = never>(definition: ChangesFetch<Row, R>) => definition,
};

const decodeFailure = (kind: string, value: unknown) =>
  new ConnectorError({ message: `Invalid ${kind} cursor value: ${String(value)}` });

export const Cursor = {
  string: (): CursorType.Definition<string> => ({
    kind: "string",
    decode: (value) =>
      typeof value === "string"
        ? Effect.succeed(value)
        : Effect.fail(decodeFailure("string", value)),
  }),

  number: (): CursorType.Definition<number> => ({
    kind: "number",
    decode: (value) =>
      typeof value === "number" && Number.isFinite(value)
        ? Effect.succeed(value)
        : Effect.fail(decodeFailure("number", value)),
  }),

  isoDateTime: (): CursorType.Definition<string> => ({
    kind: "isoDateTime",
    decode: (value) => {
      if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
        return Effect.fail(decodeFailure("ISO datetime", value));
      }
      return Effect.succeed(value);
    },
  }),

  nowIsoDateTime: Effect.map(DateTime.now, DateTime.formatIso),
};
