import { AttributeValue } from "@aws-sdk/client-dynamodb";
import { DynamoValidationError } from "./DynamoValidator";

export function toDynamoDBValue(value: any): AttributeValue {
  if (value === null || value === undefined) {
    throw new DynamoValidationError("Value cannot be null or undefined");
  }

  if (typeof value === "string") return { S: value };
  if (typeof value === "number") return { N: value.toString() };
  if (typeof value === "boolean") return { BOOL: value };
  
  if (Array.isArray(value)) {
    if (!value.length) {
      throw new DynamoValidationError("Empty arrays not supported");
    }
    const firstType = typeof value[0];
    if (value.every((item) => typeof item === firstType)) {
      if (firstType === "string") {
        return { SS: value };
      } else if (firstType === "number") {
        return { NS: value.map((n: number) => n.toString()) };
      }
    }
    return { L: value.map(toDynamoDBValue) };
  }

  if (typeof value === "object") {
    const mapVal: Record<string, AttributeValue> = {};
    for (const [k, v] of Object.entries(value)) {
      mapVal[k] = toDynamoDBValue(v);
    }
    return { M: mapVal };
  }

  throw new DynamoValidationError(`Unsupported type: ${typeof value}`);
}

export function fromDynamoDBValue(val: AttributeValue): any {
  if (val.S !== undefined) return val.S;
  if (val.N !== undefined) return parseFloat(val.N);
  if (val.BOOL !== undefined) return val.BOOL;
  if (val.SS !== undefined) return val.SS;
  if (val.NS !== undefined) return val.NS.map(n => parseFloat(n));
  if (val.M !== undefined) return mapDynamoDBItemToType<any>(val.M);
  if (val.L !== undefined) return val.L.map(v => fromDynamoDBValue(v));
  
  console.warn("Unrecognized AttributeValue:", val);
  return null;
}

export function mapDynamoDBItemToType<T>(item: Record<string, AttributeValue>): T {
  if (!item || typeof item !== 'object') {
    return {} as T;
  }

  const result: any = {};
  for (const [key, val] of Object.entries(item)) {
    if (!val || typeof val !== 'object') continue;
    result[key] = fromDynamoDBValue(val);
  }
  return result as T;
}
