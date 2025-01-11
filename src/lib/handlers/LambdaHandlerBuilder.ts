import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { EmptyError, firstValueFrom, from, map, Observable, switchMap, timeout } from "rxjs";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { IUseCase } from "../interfaces/core/IUseCase";
import { DataReflector, reflect } from "../services/reflection/DataReflector";
import { IJsonSchema } from "../interfaces/IJsonSchema";
import { IHttpHeaders } from "../interfaces/IHttpHeaders";
import { SchemaValidationError } from "../errors/SchemaValidationError";
import { RequestTimeoutError } from "../errors/RequestTimeoutError";
import { PayloadTooLargeError } from "../errors/PayloadError";
import { IQueryType } from "../interfaces/core/IQueryType";
import { HttpMethodType } from "../common/Http";

// Enhanced UseCase inline function type
export type IUseCaseInlineFunc<
    FUNC_DTO,
    USECASE_QUERY,
    USECASE_RESPONSE
> = (
    query: IQueryType<FUNC_DTO>,
    event: APIGatewayProxyEvent
) => IUseCase<USECASE_QUERY, USECASE_RESPONSE>;

type DynamicHandlerChain<InitialQuery, Handlers> = 
    Handlers extends [infer First, ...infer Rest]
        ? First extends IUseCaseInlineFunc<InitialQuery, any, infer NextResponse>
            ? [First, ...DynamicHandlerChain<NextResponse, Rest>]
            : never
        : [];

interface HandlerBuilderConfig {
    maxResponseSize?: number;
    allowedMethods?: readonly string[];
    headers?: IHttpHeaders;
    corsOriginWhitelist?: string[];
}

const validateOrigin = (requestOrigin: string | undefined, whitelist: string[] | undefined): string => {
    if (!whitelist || !requestOrigin) return '*';
    return whitelist.includes(requestOrigin) ? requestOrigin : 'null';
};

const ajv = new Ajv({
    allErrors: true,
    verbose: true,
    validateSchema: true,
    removeAdditional: true,
    useDefaults: true,
    coerceTypes: true,
});

addFormats(ajv);

const DEFAULT_MAX_RESPONSE_SIZE = 6 * 1024 * 1024;
const DEFAULT_TIMEOUT = 29000;
const DEFAULT_ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] as HttpMethodType[];

const DEFAULT_SECURITY_HEADERS: IHttpHeaders = {
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy': "default-src 'none'",
    'Cache-Control': 'no-store, max-age=0',
    'Pragma': 'no-cache'
};

export const lambdaHandlerBuilder = <
    INITIAL_QUERY_DTO extends Record<string, any> | undefined,
    HANDLERS extends readonly IUseCaseInlineFunc<any, unknown, any>[],
    REQUEST_BODY_DTO extends Record<string, any> = {},
    TARGET_BODY_TYPE extends Record<string, any> = {}
>(builderConfig: HandlerBuilderConfig = {}) => {
    const {
        maxResponseSize = DEFAULT_MAX_RESPONSE_SIZE,
        allowedMethods = DEFAULT_ALLOWED_METHODS,
        headers: securityHeaders = DEFAULT_SECURITY_HEADERS,
        corsOriginWhitelist
    } = builderConfig;

    return (
        config: {
            handlers: DynamicHandlerChain<INITIAL_QUERY_DTO, HANDLERS>;
            initialBodyReflector?: DataReflector<REQUEST_BODY_DTO, TARGET_BODY_TYPE>;
            initialQueryReflector?: DataReflector<APIGatewayProxyEvent, IQueryType<INITIAL_QUERY_DTO>>;
            errorToStatusCodeMapping?: Record<number, Array<new (...args: any[]) => Error>>;
            bodySchema?: IJsonSchema;
            timeoutMs?: number;
        }
    ) => {
        const validateSchema = config.bodySchema ? ajv.compile(config.bodySchema) : null;

        return async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
            const startTime = Date.now();
            
            try {
                // Validate HTTP method
                if (!allowedMethods.includes(event.httpMethod)) {
                    throw new Error(`Unsupported method: ${event.httpMethod}`);
                }

                // Validate content-type for POST/PUT requests
                if (['POST', 'PUT'].includes(event.httpMethod) && 
                    !event.headers['content-type']?.includes('application/json')) {
                    throw new Error('Content-Type must be application/json');
                }

                // Validate body
                if (validateSchema && event.body) {
                    const bodyData = JSON.parse(event.body);
                    const isValid = validateSchema(bodyData);
                    
                    if (!isValid) {
                        throw new SchemaValidationError(
                            'Request body validation failed',
                            validateSchema.errors || undefined
                        );
                    }
                }
                
                const initialBody = config.initialBodyReflector 
                    ? reflect(config.initialBodyReflector, JSON.parse(event.body || "")) 
                    : {} as TARGET_BODY_TYPE;

                if(Object.keys(initialBody).length > 0) event.body = JSON.stringify(initialBody)

                let initialQuery = config.initialQueryReflector
                    ? {...reflect(config.initialQueryReflector, event)}
                    : ({} as IQueryType<INITIAL_QUERY_DTO>);
            
                let observable = from([initialQuery]);
            
                for (const createHandler of config.handlers) {
                    observable = observable.pipe(
                        map((query) => {
                            const handler = createHandler(query, event);
                            const result = handler.execute(query);
                            return result instanceof Observable ? firstValueFrom(result) : result;
                        }),
                        switchMap(async result => result ?? null)
                    );
                }

                // Add timeout
                observable = observable.pipe(
                    timeout({
                        first: config.timeoutMs ?? DEFAULT_TIMEOUT,
                        with: () => { throw new RequestTimeoutError(); }
                    })
                );

                const result = await firstValueFrom(observable).catch(error => {
                    if (error instanceof EmptyError) return null;
                    throw error;
                });

                // Check response size
                const responseBody = JSON.stringify(result);
                if (Buffer.byteLength(responseBody) > maxResponseSize) {
                    throw new PayloadTooLargeError();
                }

                const allowedOrigin = validateOrigin(event.headers.origin, corsOriginWhitelist);
                const corsHeaders = { 'Access-Control-Allow-Origin': allowedOrigin };

                const response = {
                    statusCode: 200,
                    headers: {
                        ...securityHeaders,
                        ...corsHeaders,
                        'Content-Type': 'application/json',
                    },
                    body: responseBody,
                };

                console.log('Response time:', Date.now() - startTime, 'ms');

                return response;

            } catch (error) {
                console.error('Lambda handler error:', error);
                let statusCode = 500;

                const errorMapping = {
                    ...config.errorToStatusCodeMapping,
                    400: [...(config.errorToStatusCodeMapping?.[400] || []), SchemaValidationError],
                    408: [RequestTimeoutError],
                    413: [PayloadTooLargeError],
                };

                if (error instanceof Error) {
                    for (const [code, errorTypes] of Object.entries(errorMapping)) {
                        if (errorTypes.some(errorType => error instanceof errorType)) {
                            statusCode = Number(code);
                            break;
                        }
                    }
                }

                const errorBody = {
                    message: error instanceof Error ? error.message : 'Unexpected error occurred',
                    code: statusCode,
                    requestId: context.awsRequestId,
                    timestamp: new Date().toISOString()
                };

                if (error instanceof SchemaValidationError && error.errors) {
                    Object.assign(errorBody, {
                        validationErrors: error.errors.map(err => ({
                            path: err.schemaPath,
                            message: err.message,
                            keyword: err.keyword,
                            params: err.params,
                        }))
                    });
                }

                console.log('Error response time:', Date.now() - startTime, 'ms');

                const allowedOrigin = validateOrigin(event.headers.origin, corsOriginWhitelist);
                const corsHeaders = { 'Access-Control-Allow-Origin': allowedOrigin };

                return {
                    statusCode,
                    headers: {
                        ...securityHeaders,
                        ...corsHeaders,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(errorBody),
                };
            }
        };
    };
};