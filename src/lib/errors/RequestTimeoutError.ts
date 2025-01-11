export class RequestTimeoutError extends Error {
    constructor(message: string = 'Request timeout') {
        super(message);
        this.name = 'RequestTimeoutError';
    }
}