import { Observable } from "rxjs";
import {IGenericFilterQuery} from "./IFilterQuery";
import { HttpClientRequestOptions, HttpMethodType } from "../common/Http";

export interface IHttpClient {
    baseUrl:string
    get<T>(path:string, config?: HttpClientRequestOptions, filterQuery?:IGenericFilterQuery): Observable<T>;
    getRequest<T>(path:string, config?: HttpClientRequestOptions, filterQuery?:IGenericFilterQuery): Observable<Axios.AxiosXHR<T>>;
    post<T>(path:string, body?: Record<string, any>, config?: HttpClientRequestOptions): Observable<T>;
    postRequest<T>(path:string, body?: Record<string, any>, config?: HttpClientRequestOptions): Observable<Axios.AxiosXHR<T>>;
    put<T>(path:string, body?: Record<string, any>, config?: HttpClientRequestOptions): Observable<T>;
    putRequest<T>(path:string, body?: Record<string, any>, config?: HttpClientRequestOptions): Observable<Axios.AxiosXHR<T>>;
    patch<T>(path: string, body?: Record<string, any>, config?: HttpClientRequestOptions): Observable<T>;
    patchRequest<T>(path: string, body?: Record<string, any>, config?: HttpClientRequestOptions): Observable<Axios.AxiosXHR<T>>;
    delete<T>(path:string, config?: HttpClientRequestOptions): Observable<T>;
    deleteRequest<T>(path:string, config?: HttpClientRequestOptions): Observable<Axios.AxiosXHR<T>>;
    request<T, R extends boolean = false>(        
        method: HttpMethodType,
        path: string,
        options: {
            config?: HttpClientRequestOptions;
            body?: Record<string, any>;
            returnFullResponse?: R;
        },
        filterQuery?: IGenericFilterQuery) : Observable<R extends true ? Axios.AxiosXHR<T> : T>;
}