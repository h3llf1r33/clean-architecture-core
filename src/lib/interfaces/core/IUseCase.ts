import { Observable } from "rxjs";
import { IQueryType } from "./IQueryType";

export interface IUseCase<DTO, RESPONSE_MODEL> {
    execute(query?: IQueryType<DTO>): Observable<RESPONSE_MODEL>
}

export function bindUseCase<DTO, RESPONSE>(
    useCase: IUseCase<DTO, RESPONSE>
): (query: IQueryType<DTO>) => IUseCase<DTO, RESPONSE> {
    return (query) => ({
        execute: () => useCase.execute(query),
    });
}
