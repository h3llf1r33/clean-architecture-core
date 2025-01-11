// services/HttpClient.ts

import { from, map, Observable, switchMap } from "rxjs";
import { IHttpClient } from "../../interfaces/IHttpClient";
import { createHttpClientMiddlewareFactory } from "../../middleware/createMiddlewareFactory";
import { 
    deserializeGenericFilterQuery,
    IGenericFilterQuery, 
    serializeGenericFilterQuery
} from "../../interfaces/IFilterQuery";
import axios from "axios"
import { HttpClientMiddleware, HttpClientRequestOptions, HttpMethodType } from "src/lib/common/Http";

export class HttpClientAxios implements IHttpClient {
    private httpClient = axios;

    constructor(
        public readonly baseUrl: string = "", 
        private middleware: HttpClientMiddleware<HttpClientRequestOptions>[] = []
    ){}


    private buildMiddleware$(options: HttpClientRequestOptions): Observable<HttpClientRequestOptions> {
        const middlewares$ = this.middleware.map(fn => fn(options));
        return createHttpClientMiddlewareFactory(middlewares$, options) as Observable<HttpClientRequestOptions>;
    }
    
    public request<T, R extends boolean = false>(
        method: HttpMethodType,
        path: string,
        options: {
            config?: HttpClientRequestOptions;
            body?: Record<string, any>;
            returnFullResponse?: R;
        },
        filterQuery?: IGenericFilterQuery
    ): Observable<R extends true ? Axios.AxiosXHR<T> : T> {
        console.log('HTTP Method:', method, 'Type:', typeof method); // Add this line
        const filterParams = filterQuery ? serializeGenericFilterQuery(filterQuery) : "";
        const initialConfig: HttpClientRequestOptions = {
            headers: {},
            ...options.config || {}
        };
        initialConfig.baseURL = this.baseUrl;
        
        return this.buildMiddleware$(initialConfig).pipe(
            switchMap(modifiedConfig => {
                const fullUrl = `${path}${filterParams}`;
                if(filterQuery) {
                    console.log('QUERY PARAM CHECK', fullUrl);
                }

                const axiosConfig: Axios.AxiosXHRConfig<any> = {
                    ...modifiedConfig,
                    method,  // Method is now specified after spread to prevent overwrite
                    url: fullUrl,
                    data: options.body
                };

                const request$ = from(this.httpClient.request<T>(axiosConfig));

                if (options.returnFullResponse) {
                    return request$;
                }

                return request$.pipe(
                    map(resp => resp.data)
                );
            })
        ) as Observable<R extends true ? Axios.AxiosXHR<T> : T>;
    }

    // GET Requests
    get<T>(path: string, config?: HttpClientRequestOptions, filterQuery?: IGenericFilterQuery): Observable<T> {
        return this.request<T>('GET', path, { config }, filterQuery);
    }

    // POST Requests
    post<T, D extends Record<string, any>>(path: string, body?: D, config?: HttpClientRequestOptions): Observable<T> {
        return this.request<T>('POST', path, { body, config });
    }

    // PUT Requests
    put<T, D extends Record<string, any>>(path: string, body?: D, config?: HttpClientRequestOptions): Observable<T> {
        return this.request<T>('PUT', path, { body, config });
    }

    // PATCH Requests
    patch<T, D extends Record<string, any>>(path: string, body?: D, config?: HttpClientRequestOptions): Observable<T> {
        return this.request<T>('PATCH', path, { body, config });
    }

    // DELETE Requests
    delete<T>(path: string, config?: HttpClientRequestOptions, filterQuery?: IGenericFilterQuery): Observable<T> {
        return this.request<T>('DELETE', path, { config }, filterQuery);
    }

    getRequest<T>(path: string, config?: HttpClientRequestOptions, filterQuery?: IGenericFilterQuery): Observable<Axios.AxiosXHR<T>> {
        return this.request<T, true>('GET', path, {
            config,
            returnFullResponse: true,
        }, filterQuery)
    }
    
    postRequest<T>(path: string, body?: Record<string, any>, config?: HttpClientRequestOptions): Observable<Axios.AxiosXHR<T>> {
        return this.request<T, true>('POST', path, {
            body,
            config,
            returnFullResponse: true,
        })
    }
    
    putRequest<T>(path: string, body?: Record<string, any>, config?: HttpClientRequestOptions): Observable<Axios.AxiosXHR<T>> {
        return this.request<T, true>('PUT', path, {
            body,
            config,
            returnFullResponse: true,
        })
    }
    
    patchRequest<T>(path: string, body?: Record<string, any>, config?: HttpClientRequestOptions): Observable<Axios.AxiosXHR<T>> {
        return this.request<T, true>('PATCH', path, {
            body,
            config,
            returnFullResponse: true,
        })
    }
    
    deleteRequest<T>(path: string, config?: HttpClientRequestOptions): Observable<Axios.AxiosXHR<T>> {
        return this.request<T, true>('DELETE', path, {
            config,
            returnFullResponse: true,
        })
    }
    

    /**
     * Utility method to parse a URL and extract IGenericFilterQuery.
     * This can be used outside the HttpClient if needed.
     * @param url The full URL string.
     * @returns The deserialized generic filter query.
     */
    parseUrlToGenericFilterQuery(url: string): IGenericFilterQuery {
        const urlObj = new URL(url, this.baseUrl);
        return deserializeGenericFilterQuery(urlObj.search);
    }
}