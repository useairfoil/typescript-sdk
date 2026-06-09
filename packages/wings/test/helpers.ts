import { Field, Int32, makeData, RecordBatch, Schema, Struct } from "apache-arrow";
import { customAlphabet } from "nanoid";

import type { Cluster } from "../src";

import { FIELD_ID_METADATA_KEY } from "../src/lib/arrow/arrow-type";

export const makeId = customAlphabet("abcdefghijklmnopqrstuvwxyz", 12);

export const TEST_OBJECT_STORE: Cluster.ObjectStore.ObjectStore = {
  objectStoreConfig: {
    _tag: "s3Compatible",
    s3Compatible: {
      bucketName: "default-bucket",
      endpoint: "http://seaweedfs:8333",
      region: "us-east-1",
      accessKeyId: "wingsdevaccesskey",
      secretAccessKey: "wingsdevsecretkey",
      allowHttp: true,
    },
  },
};

export const TEST_LAKE: Cluster.Lake.Lake = {
  lakeConfig: { _tag: "parquet", parquet: {} },
};

export function makeTestBatch(options?: { partitionValue?: number }): RecordBatch {
  const makeField = (name: string, id: string) =>
    new Field(name, new Int32(), false, new Map([[FIELD_ID_METADATA_KEY, id]]));
  const makeInt32Data = (values: number[]) => makeData({ type: new Int32(), data: values });

  const fields = [makeField("my_field", "1"), makeField("version", "2")];
  const children = [makeInt32Data([1, 2, 3, 4]), makeInt32Data([1, 2, 3, 4])];

  if (options?.partitionValue !== undefined) {
    fields.push(makeField("my_part", "3"));
    children.push(makeInt32Data(Array.from({ length: 4 }, () => options.partitionValue ?? 0)));
  }

  const schema = new Schema(fields);
  const data = makeData({ type: new Struct(fields), length: 4, children });
  return new RecordBatch(schema, data);
}
