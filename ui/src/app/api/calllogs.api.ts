import { HttpClient } from '@angular/common/http';
import { ArrayType } from '@angular/compiler';
import { Injectable } from '@angular/core';
import { Observable, ObservedValueOf } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { ProfileWithAvatar } from './identity.api';
import { UserService } from './user.service';

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
    return this.forDate(now.getFullYear(), now.getMonth() + 1, now.getDate())
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
  forCustomer(source: string, id: string): Observable<CallLog[]> {
    return this.http.get<CallLogModel[]>(`/api/calllogs/v1/customer/${source}/${id}`)
      .pipe(
        map(result => result || []),
        this.userService.withUserByExt('agent', 'agentProfile'),
        this.userService.withUserByExt('transferTarget', 'transferToProfile'),
      );
  }
}
