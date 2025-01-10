import { HttpClientRequestOptions } from "src/lib/common/Http";
import { IGenericFilterQuery } from "../IFilterQuery";

export type IQueryType<T> = {
    data?: T;
    filterQuery?: IGenericFilterQuery;
    config?: HttpClientRequestOptions;
    entityId?: string;
};