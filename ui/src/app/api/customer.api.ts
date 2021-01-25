import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Observable } from "rxjs";

export interface Customer {
    _id?: string;
    cid: number;
    group: string;
    name: string;
    firstname: string;
    title: string;
    street: string;
    cityCode: number;
    city: string;
    phoneNumbers: string[];
    mailAddresses: string[];
}

@Injectable({
    providedIn: 'root'
})
export class CustomerAPI {
    constructor(private http: HttpClient) { }

    byId(id: number | string): Observable<Customer> {
        return this.http.get<Customer>(`/api/customer/v1/${id}`);
    }

    search(name: string): Observable<Customer[]> {
        return this.http.get<Customer[]>(`/api/customer/v1/`, {
            params: {
                name: name,
            },
        })
    }

    extendedSearch(query: any): Observable<Customer[]> {
        return this.http.post<Customer[]>(`/api/customer/v1/search/`, query);
    }
}