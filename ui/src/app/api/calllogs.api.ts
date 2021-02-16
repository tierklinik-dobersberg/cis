import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";

export interface CallLog {
  _id?: string;
  caller: string;
  inboundNumber: string;
  date: string;
  datestr: string;
  durationSeconds?: number;
  callType?: string;
  customerID?: string;
  customerSource?: string;
  agent?: string;
  transferTarget?: string;
  error?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class CalllogAPI {
  constructor(private http: HttpClient) { }

  /**
   * Returns all calllog record recorded for the given date.
   */
  forDate(year: number, month: number, day: number): Observable<CallLog[]> {
    return this.http.get<CallLog[]>(`/api/calllogs/v1/date/${year}/${month}/${day}`)
      .pipe(map(result => result || null));
  }

  /**
   * Returns all calllog records associated with a customer
   *
   * @param source The source of the customer
   * @param id The ID of the customer
   */
  forCustomer(source: string, id: string): Observable<CallLog[]> {
    return this.http.get<CallLog[]>(`/api/calllogs/v1/customer/${source}/${id}`)
      .pipe(map(result => result || null));
  }
}
