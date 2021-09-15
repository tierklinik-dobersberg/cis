import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface CustomerRef {
  cid: string;
  source: string;
}

export interface Suggestion {
  id: string;
  type: 'customer-link';
  data: {
    reason: 'same-name' | 'same-mail' | 'same-phone';
    value: string;
    refs: CustomerRef[];
    primary?: CustomerRef;
  }
}

export interface RemoteCustomer<T extends Date | string> {
  _id?: string;
  cid: string;
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
  vaccinationReminder: boolean;
  createdAt: T;
  modifiedAt: T;
}
export interface Customer extends RemoteCustomer<Date | string> {
  distinctPhoneNumbers: string[];
  createdAt: Date;
  modifiedAt: Date;
}

@Injectable({
  providedIn: 'root'
})
export class CustomerAPI {
  constructor(private http: HttpClient) { }

  getSuggestions({ limit }: { limit?: number } = {}): Observable<Suggestion[]> {
    let params = new HttpParams();
    if (!!limit && limit > 0) {
      params = params.set("limit", limit)
    }
    return this.http.get<Suggestion[]>(`/api/suggestion/v1/suggestions`, {
      params,
    });
  }

  applySuggestion(s: Suggestion): Observable<void> {
    return this.http.post(`/api/suggestion/v1/suggestions/${s.type}`, s)
      .pipe(map(() => { }));
  }

  deleteSuggestion(id: string): Observable<void> {
    return this.http.delete(`/api/suggestion/v1/suggestions/${id}`)
      .pipe(map(() => { }));
  }

  byId(ref: CustomerRef): Observable<Customer>;
  byId(source: string, id: number | string): Observable<Customer>;

  byId(sourceOrRef: string | CustomerRef, id?: number | string): Observable<Customer> {
    if (typeof sourceOrRef === 'object') {
      id = sourceOrRef.cid;
      sourceOrRef = sourceOrRef.source;
    }

    return this.http.get<Customer | null>(`/api/customer/v1/${sourceOrRef}/${id}`)
      .pipe(
        map(customer => {
          if (!customer) {
            return null;
          }

          return {
            ...customer,
            distinctPhoneNumbers: distinctPhoneNumbers(customer.phoneNumbers),
            createdAt: new Date(customer.createdAt),
            modifiedAt: new Date(customer.modifiedAt),
          };
        }));
  }

  searchName(name: string): Observable<Customer[]> {
    return this.http.get<Customer[]>(`/api/customer/v1/`, {
      params: {
        name,
      },
    })
      .pipe(map(result => result.map(customer => ({
        ...customer,
        distinctPhoneNumbers: distinctPhoneNumbers(customer.phoneNumbers)
      }))));
  }

  search(params: { [key: string]: string | string[] }): Observable<Customer[]> {
    return this.http.get<Customer[]>(`/api/customer/v1/`, {
      params,
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
  const distinct = new Map<string, string>();

  // phone numbers returned from the API are correctly formated
  // and thus contain a space between the number part and the
  // provider part. We just return numbers distinct by number-part
  // ignoring all other parts before it (international prefix and provider
  // prefix).
  (numbers || []).forEach(phoneNumber => {
    const parts = phoneNumber.split(' ');
    const key = parts[parts.length - 1];
    if (!distinct.has(key) || phoneNumber.startsWith('+')) {
      distinct.set(key, phoneNumber);
    }
  });

  return Array.from(distinct.values());
}
