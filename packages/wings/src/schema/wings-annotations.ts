import type * as Schema from "effect/Schema";

import type { TimeUnit } from "../cluster/arrow-type";

/**
 * Field id annotation used to populate Arrow field ids.
 */
export const FieldId = Symbol.for("wings/fieldId");
/**
 * @internal
 * Arrow type annotation used by Wings schema helpers.
 */
export const WingsType = Symbol.for("wings/arrowType");
/**
 * Field-level metadata annotation for Arrow fields.
 */
export const FieldMetadata = Symbol.for("wings/fieldMetadata");
/**
 * Schema-level metadata annotation for Arrow schemas.
 */
export const SchemaMetadata = Symbol.for("wings/schemaMetadata");
/**
 * @internal
 * Nullable flag annotation used by the converter.
 */
export const WingsNullable = Symbol.for("wings/nullable");

/**
 * @internal
 * Arrow primitive tags supported by the Wings schema mapper.
 */
export type PrimitiveArrowTypeTag =
  | "bool"
  | "uint8"
  | "int8"
  | "uint16"
  | "int16"
  | "uint32"
  | "int32"
  | "uint64"
  | "int64"
  | "float16"
  | "float32"
  | "float64"
  | "utf8"
  | "binary"
  | "date32"
  | "date64";

/**
 * @internal
 * Internal annotation that encodes Arrow type information.
 */
export type WingsTypeAnnotation =
  | {
      readonly _tag: "primitive";
      readonly type: PrimitiveArrowTypeTag;
    }
  | {
      readonly _tag: "timestamp";
      readonly timeUnit: TimeUnit;
      readonly timezone?: string;
    }
  | {
      readonly _tag: "duration";
      readonly timeUnit: TimeUnit;
    }
  | {
      readonly _tag: "list";
      readonly item: Schema.Top;
    };

/**
 * Declares the Wings schema annotations types on the Effect Schema namespace.
 */
declare module "effect/Schema" {
  namespace Annotations {
    interface Schema<A> {
      [FieldId]?: number | bigint;
      [WingsType]?: WingsTypeAnnotation;
      [FieldMetadata]?: Readonly<Record<string, string>>;
      [SchemaMetadata]?: Readonly<Record<string, string>>;
      [WingsNullable]?: boolean;
    }
  }
}
