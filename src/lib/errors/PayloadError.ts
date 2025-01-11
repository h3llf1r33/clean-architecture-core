export class PayloadTooLargeError extends Error {
    constructor(message: string = 'Response payload too large') {
        super(message);
        this.name = 'PayloadTooLargeError';
    }
}