import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import { TimeUnit } from "../src/cluster/arrow-type";
import {
  FieldId,
  FieldMetadata,
  SchemaMetadata,
  schemaConverter,
  WingsBinary,
  WingsBool,
  WingsDate32,
  WingsDate64,
  WingsDuration,
  WingsFloat16,
  WingsFloat32,
  WingsFloat64,
  WingsInt8,
  WingsInt16,
  WingsInt32,
  WingsInt64,
  WingsList,
  WingsNullOr,
  WingsString,
  WingsStruct,
  WingsTimestamp,
  WingsUInt8,
  WingsUInt16,
  WingsUInt32,
  WingsUInt64,
} from "../src/schema";

describe("schemaConverter", () => {
  it("converts Wings schemas to ArrowSchema", () => {
    const Customer = WingsStruct({
      id: WingsString.annotate({
        [FieldId]: 1n,
        [FieldMetadata]: { pii: "true" },
      }),
      active: WingsNullOr(WingsBool).annotate({
        [FieldId]: 18n,
      }),
      activePre: WingsNullOr(
        WingsBool.annotate({
          [FieldId]: 118n,
          [FieldMetadata]: { source: "base" },
        }),
      ),
      payload: WingsBinary.annotate({ [FieldId]: 2n }),
      u8: WingsUInt8.annotate({ [FieldId]: 3n }),
      i8: WingsInt8.annotate({ [FieldId]: 4n }),
      u16: WingsUInt16.annotate({ [FieldId]: 5n }),
      i16: WingsInt16.annotate({ [FieldId]: 6n }),
      u32: WingsUInt32.annotate({ [FieldId]: 7n }),
      i32: WingsInt32.annotate({ [FieldId]: 8n }),
      u64: WingsUInt64.annotate({ [FieldId]: 9n }),
      i64: WingsInt64.annotate({ [FieldId]: 10n }),
      f16: WingsFloat16.annotate({ [FieldId]: 11n }),
      f32: WingsFloat32.annotate({ [FieldId]: 12n }),
      f64: WingsFloat64.annotate({ [FieldId]: 13n }),
      date32: WingsDate32.annotate({ [FieldId]: 14n }),
      date64: WingsDate64.annotate({ [FieldId]: 15n }),
      createdAt: WingsTimestamp(TimeUnit.MILLISECOND, "UTC").annotate({
        [FieldId]: 16n,
      }),
      elapsed: WingsDuration(TimeUnit.SECOND).annotate({ [FieldId]: 17n }),
      tags: WingsList(
        WingsString.annotate({
          [FieldId]: 190n,
          [FieldMetadata]: { tag: "true" },
        }),
      ).annotate({ [FieldId]: 19n }),
      address: WingsStruct({
        city: WingsString.annotate({ [FieldId]: 20n }),
        zip: WingsUInt32.annotate({ [FieldId]: 21n }),
      }).annotate({ [FieldId]: 22n }),
    }).annotate({ [SchemaMetadata]: { source: "test" } });

    const result = schemaConverter(Customer);

    expect(result).toMatchInlineSnapshot(`
      {
        "fields": [
          {
            "arrowType": {
              "_tag": "utf8",
            },
            "id": 1n,
            "metadata": {
              "pii": "true",
            },
            "name": "id",
            "nullable": false,
          },
          {
            "arrowType": {
              "_tag": "bool",
            },
            "id": 18n,
            "metadata": {},
            "name": "active",
            "nullable": true,
          },
          {
            "arrowType": {
              "_tag": "bool",
            },
            "id": 118n,
            "metadata": {
              "source": "base",
            },
            "name": "activePre",
            "nullable": true,
          },
          {
            "arrowType": {
              "_tag": "binary",
            },
            "id": 2n,
            "metadata": {},
            "name": "payload",
            "nullable": false,
          },
          {
            "arrowType": {
              "_tag": "uint8",
            },
            "id": 3n,
            "metadata": {},
            "name": "u8",
            "nullable": false,
          },
          {
            "arrowType": {
              "_tag": "int8",
            },
            "id": 4n,
            "metadata": {},
            "name": "i8",
            "nullable": false,
          },
          {
            "arrowType": {
              "_tag": "uint16",
            },
            "id": 5n,
            "metadata": {},
            "name": "u16",
            "nullable": false,
          },
          {
            "arrowType": {
              "_tag": "int16",
            },
            "id": 6n,
            "metadata": {},
            "name": "i16",
            "nullable": false,
          },
          {
            "arrowType": {
              "_tag": "uint32",
            },
            "id": 7n,
            "metadata": {},
            "name": "u32",
            "nullable": false,
          },
          {
            "arrowType": {
              "_tag": "int32",
            },
            "id": 8n,
            "metadata": {},
            "name": "i32",
            "nullable": false,
          },
          {
            "arrowType": {
              "_tag": "uint64",
            },
            "id": 9n,
            "metadata": {},
            "name": "u64",
            "nullable": false,
          },
          {
            "arrowType": {
              "_tag": "int64",
            },
            "id": 10n,
            "metadata": {},
            "name": "i64",
            "nullable": false,
          },
          {
            "arrowType": {
              "_tag": "float16",
            },
            "id": 11n,
            "metadata": {},
            "name": "f16",
            "nullable": false,
          },
          {
            "arrowType": {
              "_tag": "float32",
            },
            "id": 12n,
            "metadata": {},
            "name": "f32",
            "nullable": false,
          },
          {
            "arrowType": {
              "_tag": "float64",
            },
            "id": 13n,
            "metadata": {},
            "name": "f64",
            "nullable": false,
          },
          {
            "arrowType": {
              "_tag": "date32",
            },
            "id": 14n,
            "metadata": {},
            "name": "date32",
            "nullable": false,
          },
          {
            "arrowType": {
              "_tag": "date64",
            },
            "id": 15n,
            "metadata": {},
            "name": "date64",
            "nullable": false,
          },
          {
            "arrowType": {
              "_tag": "timestamp",
              "timestamp": {
                "timeUnit": 2,
                "timezone": "UTC",
              },
            },
            "id": 16n,
            "metadata": {},
            "name": "createdAt",
            "nullable": false,
          },
          {
            "arrowType": {
              "_tag": "duration",
              "duration": 1,
            },
            "id": 17n,
            "metadata": {},
            "name": "elapsed",
            "nullable": false,
          },
          {
            "arrowType": {
              "_tag": "list",
              "list": {
                "fieldType": {
                  "arrowType": {
                    "_tag": "utf8",
                  },
                  "id": 190n,
                  "metadata": {
                    "tag": "true",
                  },
                  "name": "item",
                  "nullable": false,
                },
              },
            },
            "id": 19n,
            "metadata": {},
            "name": "tags",
            "nullable": false,
          },
          {
            "arrowType": {
              "_tag": "struct",
              "struct": {
                "subFieldTypes": [
                  {
                    "arrowType": {
                      "_tag": "utf8",
                    },
                    "id": 20n,
                    "metadata": {},
                    "name": "city",
                    "nullable": false,
                  },
                  {
                    "arrowType": {
                      "_tag": "uint32",
                    },
                    "id": 21n,
                    "metadata": {},
                    "name": "zip",
                    "nullable": false,
                  },
                ],
              },
            },
            "id": 22n,
            "metadata": {},
            "name": "address",
            "nullable": false,
          },
        ],
        "metadata": {
          "source": "test",
        },
      }
    `);
  });

  it("throws when FieldId is missing", () => {
    const Missing = WingsStruct({
      name: WingsString,
    });

    expect(() => schemaConverter(Missing)).toThrow(
      "Missing FieldId annotation",
    );
  });

  it("throws on unsupported Effect schema", () => {
    const Unsupported = Schema.Struct({
      count: Schema.Number.annotate({ [FieldId]: 1n }),
    });

    expect(() => schemaConverter(Unsupported)).toThrow("Unsupported schema");
  });
});
