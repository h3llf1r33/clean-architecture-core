import { Observable } from "rxjs";
import { IHttpHeaders } from "../interfaces/IHttpHeaders";

export type HttpClientMiddleware<T> = ((config: T) => Observable<T>);
export type HttpMethodType = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type HttpClientRequestOptions = Omit<Axios.AxiosXHRConfig<Record<string, any>>, 'url' | 'method' | 'data' | 'headers'> & {
    headers?: IHttpHeaders;
};