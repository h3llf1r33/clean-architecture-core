import { Observable } from "rxjs"
import { IEntityGateway } from "./IEntityGateway"
import { HttpClientRequestOptions } from "src/lib/common/Http"


export interface IEntityGatewayCreate<QUERY, RESPONSE_MODEL> extends IEntityGateway {
    create(query:Partial<QUERY>, config?: HttpClientRequestOptions): Observable<RESPONSE_MODEL>
}