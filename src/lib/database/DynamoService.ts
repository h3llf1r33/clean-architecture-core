import { DynamoDBClient, QueryCommand, ScanCommand, QueryCommandInput, ScanCommandInput } from "@aws-sdk/client-dynamodb";
import { IGenericFilterQuery, IPaginationQuery } from "../interfaces/IFilterQuery";
import { DynamoValidationError, validateFieldName } from "./DynamoValidator";
import { validatePagination } from "./DynamoValidator";
import { DynamoDBExpressionBuilder } from "./DynamoExpressionBuilder";
import { mapDynamoDBItemToType } from "./DynamoUtils";

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
      const { params, limit, offset } = await this.prepareQueryParameters(query);
      const items = await this.executeQuery(params, dynamoDBClient);

      // `total` is the overall count of items that match before pagination is applied.
      const total = items.length;

      // Apply pagination slicing.
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
  }> {
    const { pagination = {}, filters = [] } = query;
    validatePagination(pagination);

    const { limit, offset } = this.calculatePaginationValues(pagination);
    if (limit === 0) {
      return { params: { TableName: this.tableName }, limit: 0, offset: 0 };
    }

    const expr = this.expressionBuilder.buildFilterExpression(filters);
    return {
      params: this.buildQueryParams(expr),
      limit,
      offset
    };
  }

  private calculatePaginationValues(pagination: IPaginationQuery): { limit: number; offset: number } {
    let { page = 1, limit = 100, offset } = pagination;
  
    // Ensure page is a positive integer, default to 1 if invalid
    page = Math.max(1, Math.floor(page));
  
    // Ensure limit is a non-negative integer, default to 100 if invalid
    limit = Math.max(0, Math.floor(limit));
  
    // Calculate offset only if it's not a valid number or is less than 0
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

    if (KeyConditionExpression) {
        const queryParams = params as QueryCommandInput;
        queryParams.KeyConditionExpression = KeyConditionExpression;
        
        // Add sorting only for Query operations and if sortBy is specified
        if (pagination?.sortBy) {
            validateFieldName(pagination.sortBy);
            queryParams.ExpressionAttributeNames = queryParams.ExpressionAttributeNames || {};
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
    dynamoDBClient: DynamoDBClient
  ): Promise<any[]> {
    let response;

    if ('KeyConditionExpression' in params) {
      console.log("Executing Query with params:", JSON.stringify(params, null, 2));
      response = await dynamoDBClient.send(new QueryCommand(params as QueryCommandInput));
    } else {
      console.log("Executing Scan with params:", JSON.stringify(params, null, 2));
      response = await dynamoDBClient.send(new ScanCommand(params as ScanCommandInput));
    }
    return response.Items || [];
  }

  private processResults<T>(
    items: any[],
    limit: number,
    offset: number
  ): T[] {
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

// Re-export the original function for backward compatibility
export function fetchWithFiltersAndPagination<T>(
  tableName: string,
  query: IGenericFilterQuery,
  dynamoDBClient: DynamoDBClient,
  pkName = "id"
): Promise<{ data: T[]; total: number }> {
  const service = new DynamoDBService(tableName, pkName);
  return service.fetchWithFiltersAndPagination<T>(query, dynamoDBClient);
}