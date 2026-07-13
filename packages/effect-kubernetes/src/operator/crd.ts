import * as k8s from "@kubernetes/client-node";
import { Data, Effect, Predicate, Schema } from "effect";

import type { CustomResource, KubernetesObjectShape } from "./resource";

/** Options for generating a single-version CustomResourceDefinition. */
export interface CustomResourceDefinitionOptions {
  /** Singular resource name. Defaults to the lowercase kind. */
  readonly singular?: string;
  /** Short aliases accepted by kubectl, such as `mc`. */
  readonly shortNames?: ReadonlyArray<string>;
  /** Enables the `/status` subresource. */
  readonly status?: boolean;
  /** Enables and configures the `/scale` subresource. */
  readonly scale?: k8s.V1CustomResourceSubresourceScale;
  /** Additional columns displayed by `kubectl get`. */
  readonly additionalPrinterColumns?: ReadonlyArray<k8s.V1CustomResourceColumnDefinition>;
}

/** Failure to convert an Effect schema into a Kubernetes structural schema. */
export class CrdGenerationError extends Data.TaggedError("CrdGenerationError")<{
  /** Group, version, and plural resource name. */
  readonly resource: string;
  /** Description of the unsupported or invalid schema construct. */
  readonly message: string;
  /** Original schema conversion failure. */
  readonly cause?: unknown;
}> {}

/**
 * Generates a single-version CustomResourceDefinition from an Effect schema.
 * Unsupported non-structural constructs fail with `CrdGenerationError`.
 *
 * @example
 * ```ts
 * const Widget = Resource.custom({
 *   group: "example.com",
 *   version: "v1",
 *   kind: "Widget",
 *   plural: "widgets",
 *   namespaced: true,
 *   schema: Schema.Struct({ spec: Schema.Struct({ enabled: Schema.Boolean }) }),
 * })
 *
 * const crd = yield* Resource.makeCustomResourceDefinition(Widget, { status: true })
 * ```
 */
export const makeCustomResourceDefinition = <A extends KubernetesObjectShape>(
  resource: CustomResource<A>,
  options: CustomResourceDefinitionOptions = {},
): Effect.Effect<k8s.V1CustomResourceDefinition, CrdGenerationError> =>
  Effect.try({
    try: () => {
      if (resource.schema === undefined) {
        throw new Error("a schema is required to generate a CustomResourceDefinition");
      }

      const document = Schema.toJsonSchemaDocument(resource.schema);
      if (Object.keys(document.definitions).length > 0) {
        throw new Error("schema definitions and references are not supported");
      }

      const openAPIV3Schema = toOpenApiSchema(withoutKubernetesFields(document.schema), "$.");
      const subresources =
        options.status === true || options.scale !== undefined
          ? {
              ...(options.status === true && { status: {} }),
              ...(options.scale === undefined ? {} : { scale: options.scale }),
            }
          : undefined;

      return {
        apiVersion: "apiextensions.k8s.io/v1",
        kind: "CustomResourceDefinition",
        metadata: { name: `${resource.plural}.${resource.group}` },
        spec: {
          group: resource.group,
          names: {
            kind: resource.kind,
            plural: resource.plural,
            singular: options.singular ?? resource.kind.toLowerCase(),
            ...(options.shortNames === undefined ? {} : { shortNames: [...options.shortNames] }),
          },
          scope: resource.namespaced ? "Namespaced" : "Cluster",
          versions: [
            {
              name: resource.version,
              served: true,
              storage: true,
              schema: { openAPIV3Schema },
              subresources,
              ...(options.additionalPrinterColumns === undefined
                ? {}
                : { additionalPrinterColumns: [...options.additionalPrinterColumns] }),
            },
          ],
        },
      };
    },
    catch: (cause) =>
      new CrdGenerationError({
        resource: `${resource.group}/${resource.version}/${resource.plural}`,
        message: cause instanceof Error ? cause.message : String(cause),
        cause,
      }),
  });

// Kubernetes accepts a smaller structural subset than Effect's Draft 2020-12 output.
const supportedSchemaKeywords = new Set([
  "type",
  "title",
  "description",
  "default",
  "enum",
  "example",
  "format",
  "multipleOf",
  "maximum",
  "exclusiveMaximum",
  "minimum",
  "exclusiveMinimum",
  "maxLength",
  "minLength",
  "pattern",
  "maxItems",
  "minItems",
  "uniqueItems",
  "maxProperties",
  "minProperties",
  "nullable",
  "properties",
  "required",
  "items",
  "additionalProperties",
  "allOf",
]);

const structuralKeywords = new Set([
  "type",
  "title",
  "description",
  "default",
  "nullable",
  "properties",
  "items",
  "additionalProperties",
]);

const kubernetesFields = new Set(["apiVersion", "kind", "metadata"]);

const withoutKubernetesFields = (schema: Record<string, unknown>): Record<string, unknown> => {
  if (schema.type !== "object") throw new Error("the resource schema must have type object");

  const properties = schema.properties;
  if (!Predicate.isObject(properties)) {
    throw new Error("the resource schema must define object properties");
  }

  const { required, ...schemaWithoutRequired } = schema;
  const filteredRequired = Array.isArray(required)
    ? required.filter((name) => !kubernetesFields.has(String(name)))
    : undefined;

  // The API server validates these root fields independently of the CRD schema.
  return {
    ...schemaWithoutRequired,
    properties: Object.fromEntries(
      Object.entries(properties).filter(([name]) => !kubernetesFields.has(name)),
    ),
    ...(filteredRequired !== undefined && filteredRequired.length > 0
      ? { required: filteredRequired }
      : {}),
  };
};

const toOpenApiSchema = (
  schema: Record<string, unknown>,
  path: string,
  insideCombinator = false,
): k8s.V1JSONSchemaProps => {
  for (const keyword of Object.keys(schema)) {
    if (!supportedSchemaKeywords.has(keyword)) {
      throw new Error(`${path}${keyword} is not supported by Kubernetes structural schemas`);
    }
    if (insideCombinator && structuralKeywords.has(keyword)) {
      throw new Error(`${path}${keyword} must be declared outside allOf`);
    }
  }

  const result: k8s.V1JSONSchemaProps = {};

  if (!insideCombinator) {
    if (typeof schema.type !== "string" || schema.type.length === 0 || schema.type === "null") {
      throw new Error(`${path}type must be a non-empty, non-null JSON Schema type`);
    }
    result.type = schema.type;
  }
  if (
    schema.properties !== undefined &&
    schema.additionalProperties !== undefined &&
    schema.additionalProperties !== false
  ) {
    throw new Error(`${path}properties and additionalProperties are mutually exclusive`);
  }
  if (schema.minimum !== undefined && schema.exclusiveMinimum !== undefined) {
    throw new Error(`${path}minimum and exclusiveMinimum cannot be combined`);
  }
  if (schema.maximum !== undefined && schema.exclusiveMaximum !== undefined) {
    throw new Error(`${path}maximum and exclusiveMaximum cannot be combined`);
  }

  if (schema.title !== undefined) result.title = requireString(schema.title, `${path}title`);
  if (schema.description !== undefined) {
    result.description = requireString(schema.description, `${path}description`);
  }
  if (schema.default !== undefined) result._default = schema.default;
  if (schema.enum !== undefined) {
    if (!Array.isArray(schema.enum)) throw new Error(`${path}enum must be an array`);
    result._enum = schema.enum;
  }
  if (schema.example !== undefined) result.example = schema.example;
  if (schema.format !== undefined) result.format = requireString(schema.format, `${path}format`);

  if (schema.multipleOf !== undefined) {
    result.multipleOf = requireNumber(schema.multipleOf, `${path}multipleOf`);
  }
  if (schema.maximum !== undefined) {
    result.maximum = requireNumber(schema.maximum, `${path}maximum`);
  }
  if (schema.exclusiveMaximum !== undefined) {
    // Draft 2020-12 stores the bound as a number; Kubernetes OpenAPI 3.0 uses a flag.
    result.maximum = requireNumber(schema.exclusiveMaximum, `${path}exclusiveMaximum`);
    result.exclusiveMaximum = true;
  }
  if (schema.minimum !== undefined) {
    result.minimum = requireNumber(schema.minimum, `${path}minimum`);
  }
  if (schema.exclusiveMinimum !== undefined) {
    result.minimum = requireNumber(schema.exclusiveMinimum, `${path}exclusiveMinimum`);
    result.exclusiveMinimum = true;
  }
  if (schema.maxLength !== undefined) {
    result.maxLength = requireNumber(schema.maxLength, `${path}maxLength`);
  }
  if (schema.minLength !== undefined) {
    result.minLength = requireNumber(schema.minLength, `${path}minLength`);
  }
  if (schema.pattern !== undefined) {
    result.pattern = requireString(schema.pattern, `${path}pattern`);
  }
  if (schema.maxItems !== undefined) {
    result.maxItems = requireNumber(schema.maxItems, `${path}maxItems`);
  }
  if (schema.minItems !== undefined) {
    result.minItems = requireNumber(schema.minItems, `${path}minItems`);
  }
  if (schema.uniqueItems !== undefined) {
    if (typeof schema.uniqueItems !== "boolean") {
      throw new Error(`${path}uniqueItems must be a boolean`);
    }
    if (schema.uniqueItems) throw new Error(`${path}uniqueItems cannot be true`);
    result.uniqueItems = schema.uniqueItems;
  }
  if (schema.maxProperties !== undefined) {
    result.maxProperties = requireNumber(schema.maxProperties, `${path}maxProperties`);
  }
  if (schema.minProperties !== undefined) {
    result.minProperties = requireNumber(schema.minProperties, `${path}minProperties`);
  }
  if (schema.nullable !== undefined) {
    if (typeof schema.nullable !== "boolean") throw new Error(`${path}nullable must be a boolean`);
    result.nullable = schema.nullable;
  }

  if (schema.properties !== undefined) {
    if (!Predicate.isObject(schema.properties)) {
      throw new Error(`${path}properties must be an object`);
    }
    result.properties = Object.fromEntries(
      Object.entries(schema.properties).map(([name, property]) => {
        if (!Predicate.isObject(property)) {
          throw new Error(`${path}properties.${name} must be an object`);
        }
        return [name, toOpenApiSchema(property, `${path}properties.${name}.`)];
      }),
    );
  }
  if (schema.required !== undefined) {
    if (
      !Array.isArray(schema.required) ||
      !schema.required.every((name) => typeof name === "string")
    ) {
      throw new Error(`${path}required must be an array of strings`);
    }
    result.required = schema.required;
  }
  if (schema.items !== undefined) {
    if (!Predicate.isObject(schema.items)) {
      throw new Error(`${path}items must be a single schema object`);
    }
    result.items = toOpenApiSchema(schema.items, `${path}items.`);
  }
  if (schema.additionalProperties !== undefined && schema.additionalProperties !== false) {
    if (schema.additionalProperties === true) {
      result.additionalProperties = true;
    } else if (Predicate.isObject(schema.additionalProperties)) {
      result.additionalProperties = toOpenApiSchema(
        schema.additionalProperties,
        `${path}additionalProperties.`,
      );
    } else {
      throw new Error(`${path}additionalProperties must be a boolean or schema object`);
    }
  }
  if (schema.allOf !== undefined) {
    if (!Array.isArray(schema.allOf)) throw new Error(`${path}allOf must be an array`);
    // Effect emits independent checks as allOf entries, preserving their intersection.
    result.allOf = schema.allOf.map((part, index) => {
      if (!Predicate.isObject(part)) throw new Error(`${path}allOf[${index}] must be an object`);
      return toOpenApiSchema(part, `${path}allOf[${index}].`, true);
    });
  }

  return result;
};

const requireString = (value: unknown, path: string): string => {
  if (typeof value !== "string") throw new Error(`${path} must be a string`);
  return value;
};

const requireNumber = (value: unknown, path: string): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${path} must be a finite number`);
  }
  return value;
};
