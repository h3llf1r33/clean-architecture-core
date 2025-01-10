import { Observable } from "rxjs"
import { IEntityGateway } from "./IEntityGateway"
import { HttpClientRequestOptions } from "src/lib/common/Http"


export interface IEntityGatewayDelete<ENTITY_ID, RESPONSE_MODEL> extends IEntityGateway {
    delete(entityId: ENTITY_ID, config?: HttpClientRequestOptions): Observable<RESPONSE_MODEL>
}