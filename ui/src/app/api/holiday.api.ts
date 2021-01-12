import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Observable } from "rxjs";

export interface Holiday {
    date: string;
    name: string;
    countryCode: string;
    fixed: boolean;
    global: boolean;
    type: 'Public' | 'Bank' | 'School' | 'Authorities' | 'Optional' | 'Observance';
}

@Injectable({
    providedIn: 'root'
})
export class HolidayAPI {
    constructor(private http: HttpClient) { }

    /**
     * Returns all holidays for year.
     */
    forYear(year: number): Observable<Holiday[]> {
        return this.http.get<Holiday[]>(`/api/v1/holidays/${year}`);
    }

    /**
     * Returns all holidays for month in year.
     */
    forMonth(year: number, month: number): Observable<Holiday[]> {
        return this.http.get<Holiday[]>(`/api/v1/holidays/${year}/${month}`);
    }
}