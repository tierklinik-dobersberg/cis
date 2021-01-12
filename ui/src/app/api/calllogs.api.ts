import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Observable } from "rxjs";

export interface CallLog {
    _id?: string;
    caller: string;
    inboundNumber: string;
    date: string;
    dateStr: string;
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
        return this.http.get<CallLog[]>(`api/callogs/v1/${year}/${month}/${day}`);
    }
}