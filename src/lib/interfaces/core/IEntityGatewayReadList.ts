import { IEntityGateway } from "./IEntityGateway";
import { Observable } from "rxjs";
import { IPaginatedResponse } from "../IFilterQuery";
import { HttpClientRequestOptions } from "src/lib/common/Http";

export interface IEntityGatewayReadList<FILTER_QUERY, RESPONSE_MODEL> extends IEntityGateway {
    readList(filterQuery?: FILTER_QUERY, config?: HttpClientRequestOptions): Observable<IPaginatedResponse<RESPONSE_MODEL>>
}