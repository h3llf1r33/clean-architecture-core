import { toDynamoDBValue } from "./DynamoUtils";
import { IFilterQuery } from "../interfaces/IFilterQuery";
import { DynamoValidationError } from "./DynamoValidator";
import { validateFieldName, validateValue } from "./DynamoValidator";
export class DynamoDBExpressionBuilder {
  private readonly operatorMap: Record<string, string> = {
    "<": "<",
    ">": ">",
    "<=": "<=",
    ">=": ">=",
    "=": "=",
    "!=": "<>",
    "in": "IN",
    "not in": "NOT IN",
    "like": "contains",
    "not like": "NOT contains"
  };

  constructor(private readonly pkName: string = "id") {}

  buildFilterExpression(filters: IFilterQuery[]): DynamoDBFilterExpression {
    if (!filters.length) return {};

    // Validate all filters first
    filters.forEach(filter => {
      validateFieldName(filter.field);
      validateValue(filter.value);
    });

    const expr: DynamoDBFilterExpression = {
      ExpressionAttributeNames: {},
      ExpressionAttributeValues: {}
    };

    // Extract partition key filter
    const { pkFilter, remainingFilters } = this.extractPartitionKeyFilter(filters);
    
    if (pkFilter) {
      this.addPartitionKeyExpression(expr, pkFilter);
    }

    if (remainingFilters.length) {
      this.addFilterExpressions(expr, remainingFilters);
    }

    return expr;
  }

  private extractPartitionKeyFilter(filters: IFilterQuery[]): { 
    pkFilter?: IFilterQuery; 
    remainingFilters: IFilterQuery[] 
  } {
    const remaining = [...filters];
    const pkIndex = remaining.findIndex(
      (f) => f.field === this.pkName && f.operator === "="
    );

    if (pkIndex === -1) {
      return { remainingFilters: remaining };
    }

    const pkFilter = remaining[pkIndex];
    remaining.splice(pkIndex, 1);
    return { pkFilter, remainingFilters: remaining };
  }

  private addPartitionKeyExpression(
    expr: DynamoDBFilterExpression, 
    pkFilter: IFilterQuery
  ): void {
    expr.KeyConditionExpression = "#pk = :pkVal";
    expr.ExpressionAttributeNames!["#pk"] = pkFilter.field;
    expr.ExpressionAttributeValues![":pkVal"] = toDynamoDBValue(pkFilter.value);
  }

  private addFilterExpressions(
    expr: DynamoDBFilterExpression, 
    filters: IFilterQuery[]
  ): void {
    const subExpressions: string[] = filters.map((filter, i) => {
      const { field, operator, value } = filter;
      return this.buildSubExpression(expr, field, operator, value, i);
    });

    expr.FilterExpression = subExpressions.join(" AND ");
  }

  private buildSubExpression(
    expr: DynamoDBFilterExpression,
    field: string,
    operator: string,
    value: any,
    index: number
  ): string {
    const pathParts = field.split(".");
    pathParts.forEach((part, idx) => {
      expr.ExpressionAttributeNames![`#key${index}_${idx}`] = part;
    });

    const path = pathParts
      .map((_, idx) => `#key${index}_${idx}`)
      .join(".");

    // Special handling for different operators
    switch (operator) {
      case 'like':
      case 'not like':
        return this.buildLikeExpression(expr, path, value, index, operator === 'not like');
      case 'in':
      case 'not in':
        return this.buildInExpression(expr, path, value, index, operator === 'not in');
      default:
        return this.buildBasicExpression(expr, path, operator, value, index);
    }
  }

  private buildLikeExpression(
    expr: DynamoDBFilterExpression,
    path: string,
    value: any,
    index: number,
    isNot: boolean
  ): string {
    // Convert value to string and handle null/undefined
    const searchString = String(value);
    // Split the search string into words
    const searchTerms = searchString.toLowerCase().split(/\s+/).filter(term => term.length > 0);
    
    if (searchTerms.length === 0) {
      return isNot ? "attribute_exists(" + path + ")" : "attribute_not_exists(" + path + ")";
    }

    // Create multiple contains expressions for case variations
    const containsExpressions = searchTerms.map((term, termIndex) => {
      const valKeyLower = `:val${index}_${termIndex}_l`;
      const valKeyUpper = `:val${index}_${termIndex}_u`;
      const valKeyOriginal = `:val${index}_${termIndex}_o`;
      
      // Add three variations of the search term
      expr.ExpressionAttributeValues![valKeyLower] = toDynamoDBValue(term.toLowerCase());
      expr.ExpressionAttributeValues![valKeyUpper] = toDynamoDBValue(term.toUpperCase());
      expr.ExpressionAttributeValues![valKeyOriginal] = toDynamoDBValue(term);
      
      const containsExpr = `contains(${path}, ${valKeyLower}) OR contains(${path}, ${valKeyUpper}) OR contains(${path}, ${valKeyOriginal})`;
      return isNot ? `NOT (${containsExpr})` : containsExpr;
    });

    // Combine with appropriate logic
    return isNot 
      ? containsExpressions.join(" AND ")  // For NOT LIKE, all terms must not be present
      : `(${containsExpressions.join(" AND ")})`;  // For LIKE, all terms must be present
  }

  private buildInExpression(
    expr: DynamoDBFilterExpression,
    path: string,
    value: any,
    index: number,
    isNot: boolean
  ): string {
    // Ensure value is an array
    const values = Array.isArray(value) ? value : [value];
    
    // Create equality checks for each value
    const equalityChecks = values.map((val, valIndex) => {
      const valKey = `:val${index}_${valIndex}`;
      expr.ExpressionAttributeValues![valKey] = toDynamoDBValue(val);
      return `${path} = ${valKey}`;
    });

    // Combine with OR and handle negation
    const combinedExpression = `(${equalityChecks.join(" OR ")})`;
    return isNot ? `NOT ${combinedExpression}` : combinedExpression;
  }

  private buildBasicExpression(
    expr: DynamoDBFilterExpression,
    path: string,
    operator: string,
    value: any,
    index: number
  ): string {
    const valKey = `:val${index}`;
    expr.ExpressionAttributeValues![valKey] = toDynamoDBValue(value);

    const dynOp = this.operatorMap[operator];
    if (!dynOp) {
      throw new DynamoValidationError(`Unsupported operator: ${operator}`);
    }

    return `${path} ${dynOp} ${valKey}`;
  }
}

import { AttributeValue } from "@aws-sdk/client-dynamodb";

export interface DynamoDBFilterExpression {
  KeyConditionExpression?: string;
  FilterExpression?: string;
  ExpressionAttributeNames?: Record<string, string>;
  ExpressionAttributeValues?: Record<string, AttributeValue>;
}