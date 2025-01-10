import {IOperator} from "../lib/interfaces/IOperator";
import {convertFilterToQueryParams, IFilterQuery, parseQueryParamsToFilter} from "../lib/interfaces/IFilterQuery";

describe('Filter Query Utils', () => {
    describe('convertFilterToQueryParams', () => {
        it('should convert single filter with simple field', () => {
            const filter: IFilterQuery = {
                field: 'name',
                operator: '=',
                value: 'John'
            };
            expect(convertFilterToQueryParams(filter)).toBe('?name[eq]=John');
        });

        it('should convert single filter with nested field', () => {
            const filter: IFilterQuery = {
                field: 'user.address.city',
                operator: '=',
                value: 'New York'
            };
            expect(convertFilterToQueryParams(filter)).toBe('?user.address.city[eq]=New%20York');
        });

        it('should handle array of filters', () => {
            const filters: IFilterQuery[] = [
                { field: 'age', operator: '>=', value: 18 },
                { field: 'status', operator: 'in', value: ['active', 'pending'] }
            ];
            expect(convertFilterToQueryParams(filters))
                .toBe('?age[gte]=18&status[in]=active%2Cpending');
        });

        it('should handle numeric values', () => {
            const filter: IFilterQuery = {
                field: 'price',
                operator: '>',
                value: 100.50
            };
            expect(convertFilterToQueryParams(filter)).toBe('?price[gt]=100.5');
        });

        it('should handle "in" operator with array values', () => {
            const filter: IFilterQuery = {
                field: 'status',
                operator: 'in',
                value: ['active', 'pending', 'completed']
            };
            expect(convertFilterToQueryParams(filter))
                .toBe('?status[in]=active%2Cpending%2Ccompleted');
        });

        it('should handle object values', () => {
            const filter: IFilterQuery = {
                field: 'metadata',
                operator: '=',
                value: { key: 'value' }
            };
            expect(convertFilterToQueryParams(filter))
                .toBe('?metadata[eq]=%7B%22key%22%3A%22value%22%7D');
        });

        it('should return empty string for null/undefined filter', () => {
            expect(convertFilterToQueryParams(null as any)).toBe('');
            expect(convertFilterToQueryParams(undefined as any)).toBe('');
        });

        it('should throw error for invalid field format', () => {
            const filter: IFilterQuery = {
                field: 'invalid@field',
                operator: '=',
                value: 'test'
            };
            expect(() => convertFilterToQueryParams(filter)).toThrow('Invalid keyPath format');
        });

        it('should throw error for empty field', () => {
            const filter: IFilterQuery = {
                field: '',
                operator: '=',
                value: 'test'
            };
            expect(() => convertFilterToQueryParams(filter)).toThrow('Invalid keyPath');
        });

        it('should throw error for invalid operator', () => {
            const filter: IFilterQuery = {
                field: 'name',
                operator: 'invalid' as IOperator,
                value: 'test'
            };
            expect(() => convertFilterToQueryParams(filter)).toThrow('Invalid operator');
        });

        it('should throw error for null/undefined value', () => {
            const filter: IFilterQuery = {
                field: 'name',
                operator: '=',
                value: null as any
            };
            expect(() => convertFilterToQueryParams(filter)).toThrow('value cannot be null');
        });

        it('should throw error for non-array value with "in" operator', () => {
            const filter: IFilterQuery = {
                field: 'status',
                operator: 'in',
                value: 'not-an-array'
            };
            expect(() => convertFilterToQueryParams(filter)).toThrow('value must be an array');
        });

        it('should handle maximum length restrictions', () => {
            const longField = 'a'.repeat(101);
            const filter: IFilterQuery = {
                field: longField,
                operator: '=',
                value: 'test'
            };
            expect(() => convertFilterToQueryParams(filter)).toThrow('KeyPath exceeds maximum length');
        });
    });

    describe('parseQueryParamsToFilter', () => {
        it('should parse single filter with simple field', () => {
            const queryString = '?name[eq]=John';
            const expected: IFilterQuery[] = [{
                field: 'name',
                operator: '=',
                value: 'John'
            }];
            expect(parseQueryParamsToFilter(queryString)).toEqual(expected);
        });

        it('should parse single filter with nested field', () => {
            const queryString = '?user.address.city[eq]=New%20York';
            const expected: IFilterQuery[] = [{
                field: 'user.address.city',
                operator: '=',
                value: 'New York'
            }];
            expect(parseQueryParamsToFilter(queryString)).toEqual(expected);
        });

        it('should parse multiple filters', () => {
            const queryString = '?age[gte]=18&status[in]=active%2Cpending';
            const expected: IFilterQuery[] = [
                { field: 'age', operator: '>=', value: 18 },
                { field: 'status', operator: 'in', value: ['active', 'pending'] }
            ];
            expect(parseQueryParamsToFilter(queryString)).toEqual(expected);
        });

        it('should parse numeric values', () => {
            const queryString = '?price[gt]=100.5';
            const expected: IFilterQuery[] = [{
                field: 'price',
                operator: '>',
                value: 100.5
            }];
            expect(parseQueryParamsToFilter(queryString)).toEqual(expected);
        });

        it('should parse array values for "in" operator', () => {
            const queryString = '?status[in]=active%2Cpending%2Ccompleted';
            const expected: IFilterQuery[] = [{
                field: 'status',
                operator: 'in',
                value: ['active', 'pending', 'completed']
            }];
            expect(parseQueryParamsToFilter(queryString)).toEqual(expected);
        });

        it('should parse object values', () => {
            const queryString = '?metadata[eq]=%7B%22key%22%3A%22value%22%7D';
            const expected: IFilterQuery[] = [{
                field: 'metadata',
                operator: '=',
                value: '{"key":"value"}'
            }];
            expect(parseQueryParamsToFilter(queryString)).toEqual(expected);
        });

        it('should return empty array for empty query string', () => {
            expect(parseQueryParamsToFilter('')).toEqual([]);
            expect(parseQueryParamsToFilter('?')).toEqual([]);
        });

        it('should throw error for invalid parameter format', () => {
            expect(() => parseQueryParamsToFilter('?invalid=format'))
                .toThrow('Invalid parameter format');
        });

        it('should throw error for invalid operator', () => {
            expect(() => parseQueryParamsToFilter('?name[invalid]=test'))
                .toThrow('Invalid operator');
        });

        it('should throw error for too many parameters', () => {
            const tooManyParams = Array(101).fill('field[eq]=value').join('&');
            expect(() => parseQueryParamsToFilter(tooManyParams))
                .toThrow('Too many parameters');
        });

        it('should handle both leading question mark and without', () => {
            const withMark = '?name[eq]=John';
            const withoutMark = 'name[eq]=John';
            const expected: IFilterQuery[] = [{
                field: 'name',
                operator: '=',
                value: 'John'
            }];
            expect(parseQueryParamsToFilter(withMark)).toEqual(expected);
            expect(parseQueryParamsToFilter(withoutMark)).toEqual(expected);
        });
    });

    describe('roundtrip conversion', () => {
        it('should maintain data integrity when converting back and forth', () => {
            const originalFilters: IFilterQuery[] = [
                { field: 'name', operator: '=', value: 'John' },
                { field: 'age', operator: '>=', value: 18 },
                { field: 'status', operator: 'in', value: ['active', 'pending'] },
                { field: 'user.address.city', operator: 'like', value: 'New York' }
            ];

            const queryString = convertFilterToQueryParams(originalFilters);
            const parsedFilters = parseQueryParamsToFilter(queryString);

            expect(parsedFilters).toEqual(originalFilters);
        });
    });
});