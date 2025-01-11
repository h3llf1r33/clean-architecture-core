const MAX_FIELD_DEPTH = 20;
const MAX_FIELD_LENGTH = 255;
const MAX_VALUE_LENGTH = 400000;
const VALID_FIELD_REGEX = /^[a-zA-Z][a-zA-Z0-9_]*$/;

const UNSAFE_PATTERNS = [
  '__proto__',
  'constructor',
  'prototype',
  '$',
  ';',
  'DROP',
  'DELETE',
  'INSERT',
  'UPDATE'
];

const NOSQL_OPERATORS = [
  '$where',
  '$regex',
  '$ne',
  '$gt',
  '$lt',
  '$gte',
  '$lte',
  '$in',
  '$nin',
  '$or',
  '$and',
  '$not',
  '$exists',
  '$type',
  '$mod',
  '$text',
  '$elemMatch',
  '$size',
  '$all',
  '$expr'
];

export class DynamoValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DynamoValidationError';
  }
}

export function validateFieldName(field: string): void {
  if (!field) {
    throw new DynamoValidationError('Field name cannot be empty');
  }

  // Check for SQL/NoSQL injection patterns
  if (UNSAFE_PATTERNS.some(pattern => 
    field.toLowerCase().includes(pattern.toLowerCase()))) {
    throw new DynamoValidationError(`Field name contains unsafe pattern: ${field}`);
  }

  const parts = field.split('.');
  if (parts.length > MAX_FIELD_DEPTH) {
    throw new DynamoValidationError(`Field depth exceeds maximum of ${MAX_FIELD_DEPTH}`);
  }

  parts.forEach(part => {
    if (part.length > MAX_FIELD_LENGTH) {
      throw new DynamoValidationError(`Field part length exceeds maximum of ${MAX_FIELD_LENGTH}`);
    }
    if (!VALID_FIELD_REGEX.test(part)) {
      throw new DynamoValidationError(`Invalid characters in field name: ${part}`);
    }
  });
}

function hasInjectionPattern(obj: any): boolean {
  const patterns = [...UNSAFE_PATTERNS, ...NOSQL_OPERATORS];

  // Check object keys recursively
  function checkKeys(value: any): boolean {
    if (typeof value !== 'object' || value === null) return false;

    // Check keys
    const keys = Object.keys(value);
    if (keys.some(key => patterns.some(pattern => 
      key.toLowerCase().includes(pattern.toLowerCase()) ||
      String(value[key]).toLowerCase().includes(pattern.toLowerCase())
    ))) {
      return true;
    }

    // Recursively check values
    return keys.some(key => checkKeys(value[key]));
  }

  // Convert to string and check for patterns
  const stringified = JSON.stringify(obj);
  if (patterns.some(pattern => stringified.toLowerCase().includes(pattern.toLowerCase()))) {
    return true;
  }

  // Check keys recursively
  return checkKeys(obj);
}

export function validateValue(value: any): void {
  console.log('Validating value:', value); // Debug log
  console.log('Validating value:', value);
  console.log('Has __proto__:', Object.prototype.hasOwnProperty.call(value, '__proto__'));
  console.log('Has constructor.prototype:', Object.prototype.hasOwnProperty.call(value, 'constructor.prototype'));

  if (value === undefined || value === null) {
    console.log('Value is undefined or null'); // Debug log
    throw new DynamoValidationError('Value cannot be null or undefined');
  }

  // Early check for any dangerous patterns in stringified value
  const stringified = JSON.stringify(value);
  console.log('Stringified value:', stringified); // Debug log
  const dangerousPatterns = [
    '$where', '$regex', '$ne', '$gt', '$lt', '$gte', '$lte', 
    '$in', '$nin', '$or', '$and', '$not', '$exists', '$type',
    '$mod', '$text', '$elemMatch', '$size', '$all', '$expr',
    '__proto__', 'constructor', 'prototype'
  ];

  if (dangerousPatterns.some(pattern => 
    stringified.toLowerCase().includes(pattern.toLowerCase()))) {
    console.log('Dangerous pattern detected!'); // Debug log
    throw new DynamoValidationError('Potential NoSQL injection detected');
  }

  if (typeof value === 'string' && value.length > MAX_VALUE_LENGTH) {
    console.log('String value exceeds maximum length'); // Debug log
    throw new DynamoValidationError(`Value length exceeds maximum of ${MAX_VALUE_LENGTH}`);
  }

  if (Array.isArray(value)) {
    if (!value.length) {
      console.log('Empty array detected'); // Debug log
      throw new DynamoValidationError('Empty arrays not supported');
    }
    value.forEach(validateValue);
  } else if (typeof value === 'object' && value !== null) {
    // Additional check for dangerous properties
    const propsToCheck = [...Object.keys(value), ...Object.getOwnPropertyNames(value)];
    if (propsToCheck.some(prop => dangerousPatterns.includes(prop))) {
      console.log('Dangerous property detected in object'); // Debug log
      throw new DynamoValidationError('Potential NoSQL injection detected');
    }
    
    // Recursive check on nested values
    Object.values(value).forEach(validateValue);
  }
}



export function validatePagination(pagination: any = {}): void {
  if (!pagination) {
    pagination = {};
  }

  const { page = 1, size = 10, limit, offset = 0 } = pagination;

  if (page !== undefined && !Number.isInteger(Number(page))) {
    throw new DynamoValidationError('Page must be an integer');
  }

  if (size !== undefined && !Number.isInteger(Number(size))) {
    throw new DynamoValidationError('Size must be an integer');
  }

  if (limit !== undefined && !Number.isInteger(Number(limit))) {
    throw new DynamoValidationError('Limit must be an integer');
  }

  if (offset !== undefined && !Number.isInteger(Number(offset))) {
    throw new DynamoValidationError('Offset must be an integer');
  }
}