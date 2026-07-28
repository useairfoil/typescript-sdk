import { Context, Effect, Layer, Tuple } from "effect";

import type { ConnectorDefinition, ResourceDefinition, ResourceName } from "../core/types";

export type ResourceCheckResult =
  | { readonly _tag: "ok" }
  | { readonly _tag: "error"; readonly message: string };

export type CheckOptions<Name extends string> = {
  readonly resources: ReadonlyArray<Name>;
};

type ResourceCheckResults<Name extends PropertyKey> = {
  readonly [Key in Name]: ResourceCheckResult;
};

export type CheckResult<
  Resources extends ReadonlyArray<ResourceDefinition>,
  Name extends ResourceName<Resources> = ResourceName<Resources>,
> = ResourceCheckResults<Name>;

type CheckFailure = { readonly message: string };

const ok: ResourceCheckResult = { _tag: "ok" };

const error = (message: string): ResourceCheckResult => ({ _tag: "error", message });

const fromEntries = <Name extends string>(
  entries: ReadonlyArray<readonly [Name, ResourceCheckResult]>,
): ResourceCheckResults<Name> => Object.fromEntries(entries) as ResourceCheckResults<Name>;

const resultsFor = <Name extends string>(names: ReadonlyArray<Name>, result: ResourceCheckResult) =>
  fromEntries(names.map((name) => Tuple.make(name, result)));

/**
 * Builds the connector service from its layer and validates only the selected
 * resources. The layer remains open until every check finishes.
 */
export function check<
  Identifier,
  const Resources extends ReadonlyArray<ResourceDefinition>,
  E extends CheckFailure,
  R,
  const Name extends ResourceName<Resources>,
>(
  service: Context.Key<Identifier, ConnectorDefinition<Resources>>,
  layer: Layer.Layer<Identifier, E, R>,
  options: CheckOptions<Name>,
): Effect.Effect<CheckResult<Resources, Name>, never, R> {
  if (options.resources.length === 0) {
    return Effect.succeed(fromEntries<Name>([]));
  }

  return service.pipe(
    Effect.flatMap((connector) =>
      Effect.forEach(options.resources, (name) => {
        const resource = connector.resources.find((candidate) => candidate.name === name);
        const result = resource
          ? resource.check.pipe(
              Effect.match({
                onFailure: (failure) => error(failure.message),
                onSuccess: () => ok,
              }),
            )
          : Effect.succeed(error(`Unknown connector resource: ${name}`));

        return result.pipe(Effect.map((result) => Tuple.make(name, result)));
      }).pipe(Effect.map(fromEntries)),
    ),
    Effect.provide(layer),
    Effect.match({
      onFailure: (failure) => resultsFor(options.resources, error(failure.message)),
      onSuccess: (results) => results,
    }),
  );
}
