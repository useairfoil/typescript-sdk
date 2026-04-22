import { Field, Int32, makeData, RecordBatch, Schema, Struct } from "apache-arrow";

import { FIELD_ID_METADATA_KEY } from "../src/lib/arrow/arrow-type";

export function makeTestBatch(options?: { partitionValue?: number }): RecordBatch {
  const buildField = (name: string, id: string) =>
    new Field(name, new Int32(), false, new Map([[FIELD_ID_METADATA_KEY, id]]));
  const buildData = (values: number[]) => makeData({ type: new Int32(), data: values });

  const fields = [buildField("my_field", "1")];
  const children = [buildData([1, 2, 3, 4])];

  if (options?.partitionValue !== undefined) {
    fields.push(buildField("my_part", "2"));
    children.push(buildData(Array.from({ length: 4 }, () => options.partitionValue ?? 0)));
  }

  const schema = new Schema(fields);
  const data = makeData({
    type: new Struct(fields),
    length: 4,
    children,
  });
  return new RecordBatch(schema, data);
}
