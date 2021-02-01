import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";

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
        return this.http.get<CallLog[]>(`api/calllogs/v1/${year}/${month}/${day}`)
            .pipe(map(result => result || null));
    }
}