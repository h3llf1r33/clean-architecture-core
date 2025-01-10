import { Observable } from "rxjs"
import { IEntityGateway } from "./IEntityGateway"
import { HttpClientRequestOptions } from "src/lib/common/Http"


export interface IEntityGatewayPut<ENTITY_ID, QUERY, RESPONSE_MODEL> extends IEntityGateway {
    replaceEntity(entityId: ENTITY_ID, query: QUERY, config?: HttpClientRequestOptions): Observable<RESPONSE_MODEL>
}