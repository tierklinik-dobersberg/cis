import { HttpClient, HttpParams } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";

export interface RemoteCustomer {
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
  source: string;
}
export interface Customer extends RemoteCustomer {
  distinctPhoneNumbers: string[];
}

@Injectable({
  providedIn: 'root'
})
export class CustomerAPI {
  constructor(private http: HttpClient) { }

  byId(source: string, id: number | string): Observable<Customer> {
    return this.http.get<Customer | null>(`/api/customer/v1/${source}/${id}`)
      .pipe(
        map(customer => {
          if (!customer) {
            return null;
          }

          return {
            ...customer,
            distinctPhoneNumbers: distinctPhoneNumbers(customer.phoneNumbers)
          };
        }));
  }

  searchName(name: string): Observable<Customer[]> {
    return this.http.get<Customer[]>(`/api/customer/v1/`, {
      params: {
        name: name,
      },
    })
      .pipe(map(result => result.map(customer => ({
        ...customer,
        distinctPhoneNumbers: distinctPhoneNumbers(customer.phoneNumbers)
      }))));
  }

  search(params: { [key: string]: string | string[] }): Observable<Customer[]> {
    return this.http.get<Customer[]>(`/api/customer/v1/`, {
      params: params,
    })
      .pipe(map(result => result.map(customer => ({
        ...customer,
        distinctPhoneNumbers: distinctPhoneNumbers(customer.phoneNumbers)
      }))));
  }

  extendedSearch(query: any): Observable<Customer[]> {
    return this.http.post<Customer[]>(`/api/customer/v1/search/`, query)
      .pipe(map(result => result.map(customer => ({
        ...customer,
        distinctPhoneNumbers: distinctPhoneNumbers(customer.phoneNumbers)
      }))));
  }
}

export function distinctPhoneNumbers(numbers: string[]): string[] {
  let distinct = new Map<string, string>();

  // phone numbers returned from the API are correctly formated
  // and thus contain a space between the number part and the
  // provider part. We just return numbers distinct by number-part
  // ignoring all other parts before it (international prefix and provider
  // prefix).
  (numbers || []).forEach(number => {
    const parts = number.split(" ");
    const key = parts[parts.length - 1];
    if (!distinct.has(key)) {
      distinct.set(key, number);
    }
  })

  return Array.from(distinct.values());
}
