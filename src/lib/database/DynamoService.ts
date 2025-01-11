import { DynamoDBClient, QueryCommand, ScanCommand, QueryCommandInput, ScanCommandInput } from "@aws-sdk/client-dynamodb";
import { IGenericFilterQuery, IPaginationQuery } from "../interfaces/IFilterQuery";
import { DynamoValidationError, validateFieldName } from "./DynamoValidator";
import { validatePagination } from "./DynamoValidator";
import { DynamoDBExpressionBuilder } from "./DynamoExpressionBuilder";
import { fromDynamoDBValue, mapDynamoDBItemToType } from "./DynamoUtils";

export class DynamoDBService {
  private readonly expressionBuilder: DynamoDBExpressionBuilder;

  constructor(
    private readonly tableName: string,
    private readonly pkName: string = "id"
  ) {
    this.expressionBuilder = new DynamoDBExpressionBuilder(pkName);
  }

  async fetchWithFiltersAndPagination<T>(
    query: IGenericFilterQuery,
    dynamoDBClient: DynamoDBClient
  ): Promise<{ data: T[]; total: number }> {
    try {
      const { params, limit, offset, pagination } = await this.prepareQueryParameters(query);
      const items = await this.executeQuery(params, dynamoDBClient, pagination);
      const total = items.length;

      const data = this.processResults<T>(items, limit, offset);
      return { data, total };
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  private async prepareQueryParameters(query: IGenericFilterQuery): Promise<{
    params: QueryCommandInput | ScanCommandInput;
    limit: number;
    offset: number;
    pagination: IPaginationQuery;
  }> {
    const { pagination = {}, filters = [] } = query;
    validatePagination(pagination);

    const { limit, offset } = this.calculatePaginationValues(pagination);
    if (limit === 0) {
      return { params: { TableName: this.tableName }, limit: 0, offset: 0, pagination };
    }

    const expr = this.expressionBuilder.buildFilterExpression(filters);
    return {
      params: this.buildQueryParams(expr, pagination),
      limit,
      offset,
      pagination
    };
  }

  private calculatePaginationValues(pagination: IPaginationQuery): { limit: number; offset: number } {
    let { page = 1, limit = 100, offset } = pagination;
    page = Math.max(1, Math.floor(page));
    limit = Math.max(0, Math.floor(limit));
    if (typeof offset !== "number" || offset < 0) {
      offset = (page - 1) * limit;
    }
    return { limit, offset };
  }

  private buildQueryParams(expr: any, pagination?: IPaginationQuery): QueryCommandInput | ScanCommandInput {
    const { 
      KeyConditionExpression, 
      FilterExpression,
      ExpressionAttributeNames,
      ExpressionAttributeValues 
    } = expr;

    const params: QueryCommandInput | ScanCommandInput = { 
      TableName: this.tableName
    };

    // Use Query if we have a partition key filter.
    if (KeyConditionExpression) {
      const queryParams = params as QueryCommandInput;
      queryParams.KeyConditionExpression = KeyConditionExpression;

      // Add sorting only for Query operations and if sortBy is specified.
      if (pagination?.sortBy) {
        validateFieldName(pagination.sortBy);
        queryParams.ExpressionAttributeNames = queryParams.ExpressionAttributeNames || {};
        // The alias "#sortKey" will be used by DynamoDB if your index supports a sort key.
        queryParams.ExpressionAttributeNames['#sortKey'] = pagination.sortBy;
        queryParams.ScanIndexForward = pagination.sortDirection !== 'desc';
      }
    }

    if (FilterExpression) {
      params.FilterExpression = FilterExpression;
    }
    if (ExpressionAttributeNames) {
      params.ExpressionAttributeNames = {
        ...params.ExpressionAttributeNames,
        ...ExpressionAttributeNames
      };
    }
    if (ExpressionAttributeValues) {
      params.ExpressionAttributeValues = ExpressionAttributeValues;
    }

    return params;
  }

  private async executeQuery(
    params: QueryCommandInput | ScanCommandInput,
    dynamoDBClient: DynamoDBClient,
    pagination: IPaginationQuery
  ): Promise<any[]> {
    let response;
    if ("KeyConditionExpression" in params) {
      console.log("Executing Query with params:", JSON.stringify(params, null, 2));
      response = await dynamoDBClient.send(new QueryCommand(params as QueryCommandInput));
    } else {
      console.log("Executing Scan with params:", JSON.stringify(params, null, 2));
      response = await dynamoDBClient.send(new ScanCommand(params as ScanCommandInput));
    }

    let items = response.Items || [];

    // If a sortBy is provided, enforce client-side sorting.
    if (pagination && pagination.sortBy) {
      const sortKey = pagination.sortBy;
      const scanForward = pagination.sortDirection !== 'desc';

      // Log a sample of items with the sort key.
      console.log("Sorting items by key:", sortKey);
      items.slice(0, 5).forEach((item, index) => {
        const val = fromDynamoDBValue(item[sortKey] || { S: "" });
        console.log(`Item ${index} sort value:`, val);
      });

      items = [...items].sort((a, b) => {
        let aVal = a[sortKey] ? fromDynamoDBValue(a[sortKey]) : "";
        let bVal = b[sortKey] ? fromDynamoDBValue(b[sortKey]) : "";
        
        // Log comparison details if needed.
        // console.log("Comparing", aVal, "with", bVal);
        if (typeof aVal === "string" && typeof bVal === "string") {
          return scanForward ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }
        if (typeof aVal === "number" && typeof bVal === "number") {
          return scanForward ? aVal - bVal : bVal - aVal;
        }
        // For mixed or other types fallback to string comparison.
        aVal = String(aVal);
        bVal = String(bVal);
        return scanForward ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      });
    }

    return items;
  }

  private processResults<T>(items: any[], limit: number, offset: number): T[] {
    if (limit === 0) return [];
    if (offset >= items.length) return [];

    const endIndex = offset + limit;
    const sliced = items.slice(offset, endIndex);
    return sliced.map(item => mapDynamoDBItemToType<T>(item));
  }

  private handleError(error: any): void {
    if (error instanceof DynamoValidationError) {
      console.error("Validation error:", error.message);
    } else {
      console.error("Error in DynamoDB operation:", error);
    }
  }
}

// For backward compatibility.
export function fetchWithFiltersAndPagination<T>(
  tableName: string,
  query: IGenericFilterQuery,
  dynamoDBClient: DynamoDBClient,
  pkName = "id"
): Promise<{ data: T[]; total: number }> {
  const service = new DynamoDBService(tableName, pkName);
  return service.fetchWithFiltersAndPagination<T>(query, dynamoDBClient);
}
