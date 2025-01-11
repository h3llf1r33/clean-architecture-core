import { Observable, of } from "rxjs";
import { IEntityGatewayCrud } from "../lib/interfaces/core/IEntityGatewayCrud";
import { IFilterQuery, IGenericFilterQuery, IPaginatedResponse } from "../lib/interfaces/IFilterQuery";
import { IUser } from "../lib/interfaces/tests/IUser";
import { IHttpClient } from "../lib/interfaces/IHttpClient";
import { mockUser, mockUsers } from "../mock/User";
import axios from "axios";
import AxiosMockAdapter from "axios-mock-adapter"
import { HttpClientAxios } from "../lib/services/http/HttpClientAxios";

const mock = new AxiosMockAdapter(axios);


let BASE_URL = '';

mock.onGet("/users").reply(200, mockUsers(100));
mock.onGet(/\/user\/\d+/).reply(200, mockUser);
mock.onPut(/\/user\/\d+/).reply(200, mockUser);
mock.onPatch(/\/user\/\d+/).reply(200, mockUser);
mock.onPost("/user").reply(201, mockUser);
mock.onDelete(/\/user\/\d+/).reply(200, true);

class TestCrudGateway implements IEntityGatewayCrud<
    IUser, IUser, IGenericFilterQuery, 
    string, string, string, boolean
> {
    constructor(private httpClient: IHttpClient){}

    create(query: Partial<IUser>): Observable<IUser> {
        return this.httpClient.post<IUser>("/user", query)
    }
    createAJAX(query: Partial<IUser>): Observable<Axios.AxiosXHR<IUser>> {
        return this.httpClient.postRequest<IUser>("/user", query)
    }
    read(query?: string, filterQuery?: IGenericFilterQuery): Observable<IUser> {
        return this.httpClient.get<IUser>(`/user/${query}`, {}, filterQuery)
    }
    readAJAX(query?: string, filterQuery?: IGenericFilterQuery): Observable<Axios.AxiosXHR<IUser>> {
        return this.httpClient.getRequest<IUser>(`/user/${query}`, {}, filterQuery)
    }
    readList(filterQuery?: IGenericFilterQuery): Observable<IPaginatedResponse<IUser>> {
        return this.httpClient.get<IPaginatedResponse<IUser>>("/users", {}, filterQuery)
    }
    readListAJAX(filterQuery?: IGenericFilterQuery): Observable<Axios.AxiosXHR<IUser[]>> {
        return this.httpClient.getRequest<IUser[]>("/users", {}, filterQuery)
    }
    updateEntity(entityId: string, query: Partial<IUser>): Observable<IUser> {
        return this.httpClient.patch<IUser>(`/user/${entityId}`, query)
    }
    updateEntityAJAX(entityId: string, query: Partial<IUser>): Observable<Axios.AxiosXHR<IUser>> {
        return this.httpClient.patchRequest<IUser>(`/user/${entityId}`, query)
    }
    replaceEntity(entityId: string, query: Partial<IUser>): Observable<IUser> {
        return this.httpClient.put<IUser>(`/user/${entityId}`, query)
    }
    replaceEntityAJAX(entityId: string, query: Partial<IUser>): Observable<Axios.AxiosXHR<IUser>> {
        return this.httpClient.putRequest<IUser>(`/user/${entityId}`, query)
    }
    delete(entityId: string): Observable<boolean> {
        return this.httpClient.delete<boolean>(`/user/${entityId}`)
    }
    deleteAJAX(entityId: string): Observable<Axios.AxiosXHR<boolean>> {
        return this.httpClient.deleteRequest<boolean>(`/user/${entityId}`)
    }
}

describe('', () => {
    test('should be able to fetch data over each method', async () => {
      const crudEntityGateway = new TestCrudGateway(new HttpClientAxios(""));
  
      const readData = await crudEntityGateway.read("1", {filters: [
        {
            field: 'name',
            operator: "=",
            value: 'hello world'
        }
      ], pagination: {}}).toPromise();
      expect(readData).toMatchSnapshot();
  
      const readListData = await crudEntityGateway.readList().toPromise();
      expect(readListData).toMatchSnapshot();
  
      const createData = await crudEntityGateway.create(mockUser).toPromise();
      expect(createData).toMatchSnapshot();
  
      const patchData = await crudEntityGateway.updateEntity("1", mockUser).toPromise();
      expect(patchData).toMatchSnapshot();

      const putData = await crudEntityGateway.replaceEntity("1", mockUser).toPromise();
      expect(putData).toMatchSnapshot();
  
      const deleteData = await crudEntityGateway.delete("1").toPromise();
      expect(deleteData).toMatchSnapshot();
    });

    test('should have modified Content-Type over middleware for each method', async () => {
        const crudEntityGateway = new TestCrudGateway(new HttpClientAxios("", [
          (config) => {
              if(!config.headers) config.headers = {}
              config.headers['Content-Type'] = 'application/fantasy'
              return of(config)
          }
        ]));
    
        const readData = await crudEntityGateway.readAJAX("1").toPromise();
        expect(readData?.config?.headers?.['Content-Type']).toMatchSnapshot();
    
        const readListData = await crudEntityGateway.readListAJAX().toPromise();
        expect(readListData?.config?.headers?.['Content-Type']).toMatchSnapshot();
    
        const createData = await crudEntityGateway.createAJAX(mockUser).toPromise();
        expect(createData?.config?.headers?.['Content-Type']).toMatchSnapshot();
    
        const patchData = await crudEntityGateway.updateEntityAJAX("1", mockUser).toPromise();
        expect(patchData?.config?.headers?.['Content-Type']).toMatchSnapshot();
  
        const putData = await crudEntityGateway.replaceEntityAJAX("1", mockUser).toPromise();
        expect(putData?.config?.headers?.['Content-Type']).toMatchSnapshot();
    
        const deleteData = await crudEntityGateway.deleteAJAX("1").toPromise();
        expect(deleteData?.config?.headers?.['Content-Type']).toMatchSnapshot();
      });
  });
  