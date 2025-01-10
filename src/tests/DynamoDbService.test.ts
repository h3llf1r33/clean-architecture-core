import { DynamoDBClient, ScanCommand, QueryCommand } from "@aws-sdk/client-dynamodb";
import { fetchWithFiltersAndPagination } from '../lib/database/DynamoService';
import { IGenericFilterQuery, IFilterQuery, IPaginationQuery } from '../lib/interfaces/IFilterQuery';
import { DynamoValidationError, validateValue } from "../lib/database/DynamoValidator";
import { DynamoDBExpressionBuilder } from "../lib/database/DynamoExpressionBuilder";

const expressionBuilder = new DynamoDBExpressionBuilder();
const mockEmptyResponse = { Items: [] };
const mockStandardResponse = { 
  Items: [{ 
    id: { N: '1' }, 
    name: { S: 'Test' },
    active: { BOOL: true },
    tags: { SS: ['tag1', 'tag2'] },
    counts: { NS: ['1', '2', '3'] },
    metadata: { M: { key: { S: 'value' } } },
    list: { L: [{ S: 'item1' }, { N: '123' }] }
  }]
};

// Mock setup
jest.mock('@aws-sdk/client-dynamodb', () => {
  const originalModule = jest.requireActual('@aws-sdk/client-dynamodb');

  return {
    ...originalModule,
    DynamoDBClient: jest.fn().mockImplementation(() => ({
      send: jest.fn().mockImplementation((command) => {
        // Für limit=0, mache den DynamoDB-Aufruf nicht
        if (command.input?.Limit === 0) {
          return Promise.resolve({ Items: [] });
        }
        // Für offset > Ergebnisgröße
        if (command.input?.Offset > 100) {
          return Promise.resolve({ Items: [] });
        }
        // Standardantwort für andere Fälle
        return Promise.resolve({
          Items: [{ 
            id: { N: '1' }, 
            name: { S: 'Test' },
            active: { BOOL: true },
            tags: { SS: ['tag1', 'tag2'] },
            counts: { NS: ['1', '2', '3'] },
            metadata: { M: { key: { S: 'value' } } },
            list: { L: [{ S: 'item1' }, { N: '123' }] }
          }]
        });
      })
    })),
    ScanCommand: jest.fn(),
    QueryCommand: jest.fn()
  };
});

describe('DynamoDB Service Tests', () => {
  let mockDynamoClient: jest.Mocked<DynamoDBClient>;

  beforeEach(() => {
    mockDynamoClient = new DynamoDBClient({}) as any;
    jest.clearAllMocks();
  });

  describe('NoSQL Injection Prevention', () => {
    it('should prevent NoSQL injection in values', () => {
      const maliciousValues = [
        { $where: 'malicious' } as any,
        Object.defineProperty({}, '__proto__', { value: { evil: true }, enumerable: true }),
        Object.defineProperty({}, 'constructor.prototype', { value: { evil: true }, enumerable: true }),
        { $regex: '.*' },
        { nested: { $ne: null } }
      ];
  
      maliciousValues.forEach(value => {
        expect(() => expressionBuilder.buildFilterExpression([{
          field: 'validField',
          operator: '=',
          value
        }])).toThrow(DynamoValidationError);
      });
    });
  });

  describe('Data Type Handling', () => {
    it('should handle mixed array types', () => {
      const filter: IFilterQuery = {
        field: 'data',
        operator: '=',
        value: [1, 'text', true]
      };

      const result = expressionBuilder.buildFilterExpression([filter]);
      expect(result.ExpressionAttributeValues?.[':val0']).toHaveProperty('L');
    });

    it('should handle nested objects', () => {
      const filter: IFilterQuery = {
        field: 'data',
        operator: '=',
        value: { nested: { deep: { value: 123 } } }
      };

      const result = expressionBuilder.buildFilterExpression([filter]);
      expect(result.ExpressionAttributeValues?.[':val0']).toHaveProperty('M');
    });

    it('should handle unrecognized attribute types', async () => {
      const mockClientWithBadType = new DynamoDBClient({}) as any;
      mockClientWithBadType.send = jest.fn().mockResolvedValue({
        Items: [{
          id: { N: '1' },
          weird: { UNKNOWN_TYPE: 'value' },
          normal: { S: 'test' }
        }]
      });

      const result = await fetchWithFiltersAndPagination(
        'table',
        { filters: [], pagination: {} },
        mockClientWithBadType
      );

      expect(result[0]).toMatchObject({
        id: 1,
        weird: null,
        normal: 'test'
      });
    });
  });

  describe('Pagination Handling', () => {
    it('should handle limit=0', async () => {
      const result = await fetchWithFiltersAndPagination(
        'table',
        { 
          filters: [], 
          pagination: { limit: 0 } 
        },
        mockDynamoClient
      );

      expect(result).toEqual([]);
    });

    it('should handle offset larger than result set', async () => {
      const result = await fetchWithFiltersAndPagination(
        'table',
        { 
          filters: [], 
          pagination: { offset: 1000 } 
        },
        mockDynamoClient
      );

      expect(result).toEqual([]);
    });

    it('should handle missing pagination object', async () => {
      const result = await fetchWithFiltersAndPagination(
        'table',
        { filters: [] } as unknown as IGenericFilterQuery,
        mockDynamoClient
      );

      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle float values in pagination', async () => {
      const query: IGenericFilterQuery = {
        filters: [],
        pagination: {
          page: 1.5,
          limit: 3.14,
          offset: 4.2
        }
      };

      await expect(fetchWithFiltersAndPagination(
        'table',
        query,
        mockDynamoClient
      )).rejects.toThrow(/must be an integer/);
    });

    it('should handle string values in pagination', async () => {
      const query: IGenericFilterQuery = {
        filters: [],
        pagination: {
          page: '1' as any,
          limit: 'invalid' as any,
          offset: '0' as any
        }
      };

      await expect(fetchWithFiltersAndPagination(
        'table',
        query,
        mockDynamoClient
      )).rejects.toThrow(/must be an integer/);
    });
  });

  describe('Filter Expression Building', () => {
    it('should return empty object for empty filters', () => {
      const result = expressionBuilder.buildFilterExpression([]);
      expect(result).toEqual({});
    });

    it('should handle basic field filtering', () => {
      const filters: IFilterQuery[] = [{
        field: 'validField',
        operator: '=',
        value: 'Test'
      }];

      const result = expressionBuilder.buildFilterExpression(filters);
      expect(result.FilterExpression).toBe('#key0_0 = :val0');
      expect(result.ExpressionAttributeNames?.['#key0_0']).toBe('validField');
      expect(result.ExpressionAttributeValues?.[':val0']).toEqual({ S: 'Test' });
    });

    const operators = ['<', '>', '<=', '>=', '=', '!=', 'in', 'not in', 'like', 'not like'];
    operators.forEach(operator => {
      it(`should handle ${operator} operator`, () => {
        const filter: IFilterQuery = {
          field: 'validField',
          operator: operator as any,
          value: operator === 'in' || operator === 'not in' ? ['value'] : 'value'
        };

        const result = expressionBuilder.buildFilterExpression([filter]);
        expect(result.FilterExpression).toBeDefined();
      });
    });
  });

  describe('Query vs Scan Operations', () => {
    it('should use Query when filtering on partition key', async () => {
      const query: IGenericFilterQuery = {
        filters: [{
          field: 'id',
          operator: '=',
          value: '123'
        }],
        pagination: { limit: 10 }
      };

      await fetchWithFiltersAndPagination('table', query, mockDynamoClient);
      expect(QueryCommand).toHaveBeenCalled();
      expect(ScanCommand).not.toHaveBeenCalled();
    });

    it('should use Scan for non-key filters', async () => {
      const query: IGenericFilterQuery = {
        filters: [{
          field: 'validField',
          operator: '=',
          value: 'test'
        }],
        pagination: { limit: 10 }
      };

      await fetchWithFiltersAndPagination('table', query, mockDynamoClient);
      expect(ScanCommand).toHaveBeenCalled();
      expect(QueryCommand).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle DynamoDB errors appropriately', async () => {
      const errorMock = new DynamoDBClient({}) as any;
      errorMock.send = jest.fn().mockRejectedValue(new Error('DynamoDB Error'));

      await expect(fetchWithFiltersAndPagination(
        'table',
        { filters: [], pagination: { limit: 10 } },
        errorMock
      )).rejects.toThrow('DynamoDB Error');
    });

    it('should handle validation errors separately', async () => {
      const query: IGenericFilterQuery = {
        filters: [{
          field: 'test',
          operator: 'invalid' as any,
          value: 'test'
        }],
        pagination: { limit: 10 }
      };

      await expect(fetchWithFiltersAndPagination(
        'table',
        query,
        mockDynamoClient
      )).rejects.toThrow(DynamoValidationError);
    });
  });

  describe('validateValue Function', () => {
    it('should throw DynamoValidationError for malicious values', () => {
      const maliciousValues = [
        { $where: 'malicious' },
        Object.defineProperty({}, '__proto__', { value: { evil: true }, enumerable: true }),
        Object.defineProperty({}, 'constructor.prototype', { value: { evil: true }, enumerable: true }),
        { $regex: '.*' },
        { nested: { $ne: null } }
      ];
  
      maliciousValues.forEach(value => {
        expect(() => validateValue(value)).toThrow(DynamoValidationError);
      });
    });
  
    it('should not throw for safe values', () => {
      const safeValues = [
        'safeString',
        123,
        true,
        { safeKey: 'safeValue' },
        [1, 'two', false]
      ];
  
      safeValues.forEach(value => {
        expect(() => validateValue(value)).not.toThrow();
      });
    });
  });

});
