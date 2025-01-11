import { IEntityGatewayCreate } from "./IEntityGatewayCreate";
import { IEntityGatewayRead } from "./IEntityGatewayRead";
import { IEntityGatewayReadList } from "./IEntityGatewayReadList";
import { IEntityGatewayPatch } from "./IEntityGatewayPatch";
import { IEntityGatewayDelete } from "./IEntityGatewayDelete";
import { IEntityGateway } from "./IEntityGateway";
import { IEntityGatewayPut } from "./IEntityGatewayPut";

export interface IEntityGatewayCrud<
    CREATE_OR_UPDATE_QUERY, RESPONSE_MODEL, 
    FILTER_QUERY, READ_ENTITY_ID, 
    UPDATE_ENTITY_ID, DELETE_ENTITY_ID, 
    DELETE_RESPONSE_MODEL 
> extends 
    IEntityGateway,
    IEntityGatewayCreate<CREATE_OR_UPDATE_QUERY, RESPONSE_MODEL>,
    IEntityGatewayRead<READ_ENTITY_ID, FILTER_QUERY, RESPONSE_MODEL>,
    IEntityGatewayReadList<FILTER_QUERY, RESPONSE_MODEL>,
    IEntityGatewayPut<UPDATE_ENTITY_ID, CREATE_OR_UPDATE_QUERY, RESPONSE_MODEL>,
    IEntityGatewayPatch<UPDATE_ENTITY_ID, CREATE_OR_UPDATE_QUERY, RESPONSE_MODEL>,
    IEntityGatewayDelete<DELETE_ENTITY_ID, DELETE_RESPONSE_MODEL> {
}