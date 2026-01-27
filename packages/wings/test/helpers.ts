import { Int32, makeData, RecordBatch } from "apache-arrow";
import type { FieldConfig } from "../src/lib/arrow";

export function testBatchSchema(): FieldConfig {
  return {
    name: "my_field",
    nullable: false,
    dataType: "Int32",
    description: "test field",
  };
}

export function testPartitionKeySchema(): FieldConfig {
  return {
    name: "my_part",
    nullable: false,
    dataType: "Int32",
    description: "partition field",
  };
}

export function makeTestBatch(): RecordBatch {
  return new RecordBatch({
    my_field: makeData({
      type: new Int32(),
      data: [1, 2, 3, 4],
    }),
  });
}
