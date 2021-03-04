import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Holiday {
    date: string;
    name: string;
    localName: string;
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
        return this.http.get<Holiday[] | null>(`/api/holidays/v1/${year}`)
            .pipe(map(res => res || []));
    }

    /**
     * Returns all holidays for month in year.
     */
    forMonth(year: number, month: number): Observable<Holiday[]> {
        return this.http.get<Holiday[] | null>(`/api/holidays/v1/${year}/${month}`)
            .pipe(map(res => res || []));
    }
}
