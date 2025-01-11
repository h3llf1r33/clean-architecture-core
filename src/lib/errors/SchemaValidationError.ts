import { ErrorObject } from "ajv";

export class SchemaValidationError extends Error {
    constructor(message: string, public readonly errors?: ErrorObject[]) {
        super(message);
        this.name = 'SchemaValidationError';
    }
}