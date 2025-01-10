import { JSONPath as jsonpath } from '@astronautlabs/jsonpath';

type CustomJsonPath = string & { __brand?: 'CustomJsonPath' };
type ArrayIndex = `[${number}]`;
type ArraySlice = `[${number}:${number}]` | '[*]' | `[${number}:]` | `[:${number}]`;
type ArrayAccess = ArrayIndex | ArraySlice;

type RecursivePath<T> = T extends Array<infer U>
    ? `${ArrayAccess}${RecursivePath<U>}` | ArrayAccess
    : T extends object
        ? {
              [K in keyof T & string]: `['${K}']${RecursivePath<T[K]>}` | `['${K}']`;
          }[keyof T & string]
        : '';

type JsonPath<T> = `$${RecursivePath<T>}`;

type DataReflectorValue<Input, Output> =
    | JsonPath<Input>
    | CustomJsonPath
    | ((input: Input) => Output)
    | { [K in keyof Output]: DataReflectorValue<Input, Output[K]> };

export type DataReflector<Input, Output> = {
    [K in keyof Output]: DataReflectorValue<Input, Output[K]>;
};

function hasCircular(obj: any): boolean {
    const seen = new WeakSet();
    const detect = (obj: any): boolean => {
        if (obj && typeof obj === 'object') {
            if (seen.has(obj)) return true;
            seen.add(obj);
            return Object.values(obj).some(detect);
        }
        return false;
    };
    return detect(obj);
}

function processReflectorValue<Input extends object, Output>(
    extractor: DataReflectorValue<Input, Output>,
    input: Input
): Output {
    // Handle nested object
    if (typeof extractor === 'object') {
        return reflect(extractor as DataReflector<Input, Output>, input);
    }

    // Handle function
    if (typeof extractor === 'function') {
        return (extractor as (input: Input) => Output)(input);
    }

    // Handle JSONPath
    if (typeof extractor === 'string') {
        if (!extractor.includes('*') && !extractor.includes('?') && !extractor.includes('..')) {
            const value = jsonpath.value(input, extractor);
            
            if (value && typeof value === 'object' && hasCircular(value)) {
                throw new Error('Circular data structure detected.');
            }
            
            return value;
        }

        const value = jsonpath.query(input, extractor);
        
        if (value && Array.isArray(value) && value.some(hasCircular)) {
            throw new Error('Circular data structure detected.');
        }
        
        return value as Output;
    }

    throw new Error('Invalid reflector value type');
}

export function reflect<Input extends object, Output>(
    mapping: DataReflector<Input, Output>,
    input: Input
): Output {
    return Object.entries(mapping).reduce(
        (result, [key, extractor]) => ({
            ...result,
            [key]: processReflectorValue(extractor as DataReflectorValue<Input, Output[keyof Output]>, input)
        }),
        {} as Output
    );
}

export { jsonpath }