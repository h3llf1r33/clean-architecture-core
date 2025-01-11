import { APIGatewayProxyEvent } from "aws-lambda";
import { IOperator } from "./IOperator";
import { JSONPath as jsonpath } from "@astronautlabs/jsonpath";

export interface IFilterQuery {
    field: string; // supports dot notation
    operator: IOperator;
    value: string | number | object | Array<string | number> | undefined | null;
}

export interface IPaginationQuery {
    page?: number;
    limit?: number;
    offset?: number;
    sortBy?: string;
    sortDirection?: 'asc' | 'desc';
}

export interface IPaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
}

export interface IGenericFilterQuery {
    filters: IFilterQuery[];
    pagination: IPaginationQuery;
}

// Operator Maps
const operatorMap: Record<IOperator, string> = {
    '<': 'lt',
    '>': 'gt',
    '<=': 'lte',
    '>=': 'gte',
    '=': 'eq',
    '!=': 'ne',
    'in': 'in',
    'not in': 'notin',
    'like': 'like',
    'not like': 'notlike'
};

const reverseOperatorMap: Record<string, IOperator> = Object.entries(operatorMap)
    .reduce((acc, [key, value]) => ({ ...acc, [value]: key as IOperator }), {});

// Constants for Sanitization
const MAX_KEY_LENGTH = 100;
const MAX_VALUE_LENGTH = 1000;
const MAX_ARRAY_LENGTH = 100;

// Utility Functions
function sanitizeKey(key: string): string {
    return key.trim();
}

function sanitizeValue(value: any): any {
    if(!Array.isArray(value) && typeof value !== 'object' && typeof value === "string"){
        return isNaN(Number(value)) ? value : Number(value)
    }
    if (typeof value === 'string') {
        const trimmed = value.slice(0, MAX_VALUE_LENGTH).trim();
        // Attempt to convert to number if the string represents a valid number
        const num = Number(trimmed);
        return !isNaN(num) && trimmed !== '' ? num : trimmed;
    }
    if (Array.isArray(value)) {
        return value
            .slice(0, MAX_ARRAY_LENGTH)
            .map(v => {
                if (typeof v === 'string') {
                    const trimmed = v.slice(0, MAX_VALUE_LENGTH).trim();
                    const num = Number(trimmed);
                    return !isNaN(num) && trimmed !== '' ? num : trimmed;
                }
                return v;
            });
    }
    if (typeof value === 'object' && value !== null) {
        return JSON.stringify(value).slice(0, MAX_VALUE_LENGTH);
    }
    return value;
}

function validateAndSanitizeFilter(filter: IFilterQuery): IFilterQuery {
    if (!filter || typeof filter !== 'object') {
        throw new Error('Invalid filter: must be an object');
    }

    if (!filter.field) {
        throw new Error('Invalid keyPath: must be a non-empty string');
    }

    const sanitizedKey = sanitizeKey(filter.field);

    if (sanitizedKey.length > MAX_KEY_LENGTH) {
        throw new Error(`KeyPath exceeds maximum length of ${MAX_KEY_LENGTH} characters`);
    }

    if (!/^[a-zA-Z0-9]+(?:\.[a-zA-Z0-9]+)*$/.test(sanitizedKey)) {
        throw new Error('Invalid keyPath format: must contain only alphanumeric characters and dots');
    }

    if (!filter.operator || !operatorMap[filter.operator]) {
        throw new Error('Invalid operator');
    }

    if (filter.value === undefined || filter.value === null) {
        throw new Error('value cannot be null or undefined');
    }

    const sanitizedValue = sanitizeValue(filter.value);

    if ((filter.operator === 'in' || filter.operator === 'not in') && !Array.isArray(filter.value)) {
        throw new Error('value must be an array for "in" and "not in" operators');
    }

    return {
        field: sanitizedKey,
        operator: filter.operator,
        value: sanitizedValue
    };
}

/**
 * Serializes IGenericFilterQuery into URL query parameters.
 * @param query The generic filter query.
 * @returns A string representing the serialized query parameters.
 */
export function serializeGenericFilterQuery(query: IGenericFilterQuery): string {
    const params: Record<string, string> = {};
    query.filters = query.filters.map((data) => ({
        field: data.field,
        operator: data.operator,
        value: sanitizeValue(data.value)
    }));

    if (query.filters && query.filters.length > 0) {
        params.filters = encodeURIComponent(JSON.stringify(query.filters));
    }

    if (query.pagination) {
        const { sortBy, sortDirection, ...paginationParams } = query.pagination;
        params.pagination = encodeURIComponent(JSON.stringify(paginationParams));
        
        // Add sorting parameters separately
        if (sortBy) params.sortBy = encodeURIComponent(sortBy);
        if (sortDirection) params.sortDirection = encodeURIComponent(sortDirection);
    }

    const queryString = Object.entries(params)
        .map(([key, value]) => `${key}=${value}`)
        .join('&');

    return queryString ? `?${queryString}` : '';
}

/**
 * Deserializes URL query parameters into IGenericFilterQuery.
 * @param queryString The URL query string.
 * @returns The deserialized generic filter query.
 */
export function deserializeGenericFilterQuery(queryString: string): IGenericFilterQuery {
    const params = new URLSearchParams(queryString);
    const filtersParam = params.get('filters');
    const paginationParam = params.get('pagination');
    const sortBy = params.get('sortBy');
    const sortDirection = params.get('sortDirection');

    let filters: IFilterQuery[] = [];
    let pagination: IPaginationQuery = {};

    try {
        if (filtersParam) {
            const parsedFilters: IFilterQuery[] = JSON.parse(decodeURIComponent(filtersParam));
            filters = parsedFilters.map(filter => validateAndSanitizeFilter(filter));
        }
    } catch (error) {
        console.error('Error parsing filters:', error);
    }

    try {
        if (paginationParam) {
            const parsedPagination: IPaginationQuery = JSON.parse(decodeURIComponent(paginationParam));
            pagination = {
                page: typeof parsedPagination.page === 'number' ? parsedPagination.page : undefined,
                limit: typeof parsedPagination.limit === 'number' ? parsedPagination.limit : undefined,
                offset: typeof parsedPagination.offset === 'number' ? parsedPagination.offset : undefined,
            };
        }
        
        // Add sorting parameters if present
        if (sortBy) {
            pagination.sortBy = decodeURIComponent(sortBy);
        }
        if (sortDirection && ['asc', 'desc'].includes(sortDirection.toLowerCase())) {
            pagination.sortDirection = decodeURIComponent(sortDirection) as 'asc' | 'desc';
        }
    } catch (error) {
        console.error('Error parsing pagination:', error);
    }

    return { filters, pagination };
}

export const extractGenericFilterQueryFromEvent = (event: APIGatewayProxyEvent): IGenericFilterQuery => {
    const queryParams = event.queryStringParameters || {};

    const filters = jsonpath.query(queryParams, "$..filters").map((filterString: string) => {
        const filter = JSON.parse(filterString);
        return {
            field: filter.field,
            operator: filter.operator as IOperator,
            value: filter.value,
        };
    }).map(filter => validateAndSanitizeFilter(filter));

    const pagination: IPaginationQuery = {
        page: parseInt(queryParams.page || "1", 10),
        limit: parseInt(queryParams.limit || "10", 10),
        offset: parseInt(queryParams.offset || "0", 10),
        sortBy: queryParams.sortBy,
        sortDirection: queryParams.sortDirection as 'asc' | 'desc' | undefined
    };

    // Validate sort direction
    if (pagination.sortDirection && !['asc', 'desc'].includes(pagination.sortDirection)) {
        pagination.sortDirection = undefined;
    }

    return {
        filters,
        pagination,
    };
};

export function convertFilterToQueryParams(filter: IFilterQuery | IFilterQuery[]): string {
    if (!filter) return '';

    const filters = Array.isArray(filter) ? filter : [filter];
    if (!filters.length) return '';

    if (filters.length > MAX_ARRAY_LENGTH) {
        throw new Error(`Too many filters: maximum allowed is ${MAX_ARRAY_LENGTH}`);
    }

    const params = filters.map(filter => {
        const sanitizedFilter = validateAndSanitizeFilter(filter);
        let processedValue = sanitizedFilter.value;

        if (Array.isArray(processedValue)) {
            processedValue = processedValue.join(',');
        } else if (typeof processedValue === 'object') {
            processedValue = JSON.stringify(processedValue);
        }

        const encodedValue = encodeURIComponent(String(processedValue));
        return `${sanitizedFilter.field}[${operatorMap[sanitizedFilter.operator]}]=${encodedValue}`;
    });

    return params.length ? `?${params.join('&')}` : '';
}

export function parseQueryParamsToFilter(queryString: string): IFilterQuery[] {
    if (!queryString) return [];

    const query = queryString.startsWith('?') ? queryString.slice(1) : queryString;
    if (!query) return [];

    const params = query.split('&');
    if (params.length > MAX_ARRAY_LENGTH) {
        throw new Error(`Too many parameters: maximum allowed is ${MAX_ARRAY_LENGTH}`);
    }

    return params.map(param => {
        const match = param.match(/^([^[\]]+)\[([^\]]+)]=(.+)$/);
        if (!match) {
            throw new Error(`Invalid parameter format: ${param}`);
        }

        const [, keyPath, operator, encodedValue] = match;
        const mappedOperator = reverseOperatorMap[operator];

        if (!mappedOperator) {
            throw new Error(`Invalid operator: ${operator}`);
        }

        const decodedValue = decodeURIComponent(encodedValue);
        let parsedValue: any = decodedValue;

        if (mappedOperator === 'in' || mappedOperator === 'not in') {
            parsedValue = decodedValue.split(',')
                .map(v => {
                    const num = Number(v);
                    return !isNaN(num) ? num : v.trim();
                });
        } else {
            const numberValue = Number(decodedValue);
            if (!isNaN(numberValue) && decodedValue !== '') {
                parsedValue = numberValue;
            } else if (decodedValue.startsWith('{') || decodedValue.startsWith('[')) {
                try {
                    parsedValue = JSON.parse(decodedValue);
                } catch {
                    parsedValue = decodedValue;
                }
            }
        }

        return validateAndSanitizeFilter({
            field: keyPath,
            operator: mappedOperator,
            value: parsedValue
        });
    });
}
