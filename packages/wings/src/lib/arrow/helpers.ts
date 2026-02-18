import { type RecordBatch, Table, tableFromJSON } from "apache-arrow";
import { type FieldConfig, partitionKeyArrowTypes } from "./schema";

export function canBePartitionKey(dataType: FieldConfig["dataType"]): boolean {
  return partitionKeyArrowTypes.includes(
    dataType as (typeof partitionKeyArrowTypes)[number],
  );
}

export function recordBatchToTable(batch: RecordBatch[]) {
  return new Table(batch);
}

export function arrowTableToRowColumns(table: Table) {
  const columns = table.schema.fields.map((field) => ({
    name: field.name,
    type: field.type.toString(),
  }));
  const rows = table.toArray();
  return { columns, rows };
}

export { tableFromJSON };
