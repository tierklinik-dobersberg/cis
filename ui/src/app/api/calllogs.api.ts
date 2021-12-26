import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { CustomerRef } from './customer.api';
import { ProfileWithAvatar } from './identity.api';
import { UserService } from './user.service';

export interface CalllogQuery {
  at?: Date;
  from?: Date;
  to?: Date;
  cid?: string;
}

export interface SearchResult {
  items: CallLog[];
}

export interface CallLogModel {
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

/*
export type ArrayItem<T> = T extends Array<infer Y> ? Y : never;
export type CallLog = ArrayItem<ObservedValueOf<ReturnType<CalllogAPI['forDate']>>>
*/
export interface CallLog extends CallLogModel {
  agentProfile?: ProfileWithAvatar;
  transferToProfile?: ProfileWithAvatar;
}

@Injectable({
  providedIn: 'root'
})
export class CalllogAPI {
  constructor(
    private http: HttpClient,
    private userService: UserService,
  ) { }

  forToday(): Observable<CallLog[]> {
    const now = new Date();
    return this.forDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
  }

  /**
   * Returns all calllog record recorded for the given date.
   */
  forDate(year: number, month: number, day: number): Observable<CallLog[]> {
    return this.http.get<CallLogModel[]>(`/api/calllogs/v1/date/${year}/${month}/${day}`)
      .pipe(
        map(result => result || []),
        this.userService.withUserByExt('agent', 'agentProfile'),
        this.userService.withUserByExt('transferTarget', 'transferToProfile'),
      );
  }

  /**
   * Returns all calllog records associated with a customer
   *
   * @param source The source of the customer
   * @param id The ID of the customer
   */
  forCustomer(ref: CustomerRef): Observable<CallLog[]>;
  forCustomer(source: string, id: string): Observable<CallLog[]>;
  forCustomer(sourceOrRef: string | CustomerRef, id?: string): Observable<CallLog[]> {
    if (typeof sourceOrRef === 'object') {
      id = sourceOrRef.cid;
      sourceOrRef = sourceOrRef.source;
    }
    return this.http.get<CallLogModel[]>(`/api/calllogs/v1/customer/${sourceOrRef}/${id}`)
      .pipe(
        map(result => result || []),
        this.userService.withUserByExt('agent', 'agentProfile'),
        this.userService.withUserByExt('transferTarget', 'transferToProfile'),
      );
  }

  /** Search searches for calllogs using query. */
  search(query: CalllogQuery = {}): Observable<SearchResult> {
    let p = new HttpParams();
    if (query.at) {
      p = p.set("at", query.at.toISOString())
    }
    if (query.from) {
      p = p.set("from", query.from.toISOString())
    }
    if (query.to) {
      p = p.set("to", query.to.toISOString())
    }
    if (query.cid) {
      p = p.set("cid", query.cid)
    }

    return this.http.get<SearchResult>(`/api/calllogs/v1/search`, {params: p});
  }
}
