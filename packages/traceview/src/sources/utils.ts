import type { SpanEvent } from "../model";

export const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>) : undefined;

export const stringValue = (value: unknown) =>
  value === undefined || value === null ? undefined : String(value);

export const numberValue = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

/**
 * Nanosecond timestamps must be bigint — they exceed Number.MAX_SAFE_INTEGER
 * (a 64-bit ns timestamp in 2024 is ~1.7 × 10^18, which loses precision as float64).
 */
export const bigintValue = (value: unknown) => {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isFinite(value)) return BigInt(Math.trunc(value));
  if (typeof value === "string" && /^\d+$/.test(value)) return BigInt(value);
  return undefined;
};

export const timestampUnixNanoValue = (value: unknown) => {
  const numeric = bigintValue(value);
  if (numeric !== undefined) return numeric;

  const text = stringValue(value);
  if (!text) return undefined;

  const iso = /^(.*T\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})$/.exec(text);
  if (iso) {
    const milliseconds = Date.parse(`${iso[1]}${iso[3]}`);
    if (Number.isFinite(milliseconds)) {
      const fractionalNanos = BigInt((iso[2] ?? "").padEnd(9, "0"));
      return BigInt(milliseconds) * 1_000_000n + fractionalNanos;
    }
  }

  const milliseconds = Date.parse(text);
  return Number.isFinite(milliseconds) ? BigInt(milliseconds) * 1_000_000n : undefined;
};

/**
 * Unwraps an OTel `AnyValue` protobuf union to its inner primitive.
 * OTel encodes attribute values as `{ stringValue: "..." }` or `{ string_value: "..." }`
 * depending on whether the source serialised proto field names as camelCase or snake_case.
 */
export const unwrapAnyValue = (value: unknown): unknown => {
  const record = asRecord(value);
  if (!record) return value;
  if ("stringValue" in record) return record.stringValue;
  if ("string_value" in record) return record.string_value;
  if ("intValue" in record) return record.intValue;
  if ("int_value" in record) return record.int_value;
  if ("doubleValue" in record) return record.doubleValue;
  if ("double_value" in record) return record.double_value;
  if ("boolValue" in record) return record.boolValue;
  if ("bool_value" in record) return record.bool_value;
  if ("bytesValue" in record) return record.bytesValue;
  if ("bytes_value" in record) return record.bytes_value;
  if ("arrayValue" in record) return record.arrayValue;
  if ("array_value" in record) return record.array_value;
  if ("kvlistValue" in record) return record.kvlistValue;
  if ("kvlist_value" in record) return record.kvlist_value;
  return value;
};

/** Converts an OTel `repeated KeyValue` array into a plain attribute record. */
export const keyValuesToAttributes = (value: unknown): Record<string, unknown> => {
  if (!Array.isArray(value)) return {};
  return Object.fromEntries(
    value.flatMap((entry) => {
      const record = asRecord(entry);
      const key = stringValue(record?.key);
      return key ? [[key, unwrapAnyValue(record?.value)]] : [];
    }),
  );
};

/** Parses duration strings like `"42.958us"` or `"1.5ms"` into milliseconds. */
export const durationMsValue = (value: unknown) => {
  const numeric = numberValue(value);
  if (numeric !== undefined) return numeric;

  const text = stringValue(value)?.trim();
  if (!text) return undefined;

  const match = /^(\d+(?:\.\d+)?)(ns|µs|us|ms|s)$/i.exec(text);
  if (!match) return undefined;

  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return undefined;

  switch (match[2]?.toLowerCase()) {
    case "ns":
      return amount / 1_000_000;
    case "µs":
    case "us":
      return amount / 1_000;
    case "ms":
      return amount;
    case "s":
      return amount * 1_000;
    default:
      return undefined;
  }
};

/** Parses a standard OTel `repeated Event` array into `SpanEvent[]`. */
export const otelEvents = (value: unknown): ReadonlyArray<SpanEvent> => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((event) => {
    const record = asRecord(event);
    const name = stringValue(record?.name);
    if (!record || !name) return [];
    return [
      {
        name,
        timeUnixNano: bigintValue(record.time_unix_nano ?? record.timeUnixNano ?? record.timestamp),
        attributes: keyValuesToAttributes(record.attributes),
      },
    ];
  });
};
