import { describe, expect, it } from "vitest";

import type { Cluster } from "../src";

import * as PartitionValue from "../src/utils/partition-value";
import * as TableUtils from "../src/utils/table-utils";

const table = (partitionType?: Cluster.ArrowType.ArrowType): Cluster.Table.Table => {
  const fields: ReadonlyArray<Cluster.ArrowType.Field> = [
    { name: "id", id: 1n, arrowType: { _tag: "utf8" }, nullable: false, metadata: {} },
    { name: "version", id: 2n, arrowType: { _tag: "int64" }, nullable: false, metadata: {} },
    ...(partitionType === undefined
      ? []
      : [
          {
            name: "tenant",
            id: 3n,
            arrowType: partitionType,
            nullable: false,
            metadata: {},
          } as Cluster.ArrowType.Field,
        ]),
  ];
  return {
    name: "namespaces/default/tables/products",
    schema: { fields, metadata: {} },
    keyFieldId: 1n,
    versionFieldId: 2n,
    partitionFieldId: partitionType === undefined ? undefined : 3n,
    targetFreshnessSeconds: 60n,
  };
};

describe("TableUtils partition validation", () => {
  it("accepts values matching the Wings table partition field", () => {
    expect(() =>
      TableUtils.validatePartitionValueUnsafe(table({ _tag: "utf8" }), PartitionValue.string("a")),
    ).not.toThrow();
    expect(() =>
      TableUtils.validatePartitionValueUnsafe(
        table({ _tag: "binary" }),
        PartitionValue.bytes(new Uint8Array()),
      ),
    ).not.toThrow();
    expect(() =>
      TableUtils.validatePartitionValueUnsafe(
        table({ _tag: "bool" }),
        PartitionValue.boolean(true),
      ),
    ).not.toThrow();
  });

  it("rejects missing, unexpected, and type-mismatched values", () => {
    expect(() =>
      TableUtils.validatePartitionValueUnsafe(table({ _tag: "int32" }), undefined),
    ).toThrow();
    expect(() =>
      TableUtils.validatePartitionValueUnsafe(table(), PartitionValue.int32(1)),
    ).toThrow();
    expect(() =>
      TableUtils.validatePartitionValueUnsafe(table({ _tag: "int32" }), PartitionValue.string("1")),
    ).toThrow();
  });

  it("allows a publisher default to be omitted when each push will provide a value", () => {
    expect(() =>
      TableUtils.validatePartitionValueUnsafe(table({ _tag: "int32" }), undefined, {
        allowMissing: true,
      }),
    ).not.toThrow();
  });
});
