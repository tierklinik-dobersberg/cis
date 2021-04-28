import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface OpeningHoursResponse<T = Date> {
    openingHours: OpeningHour<T>[];
    isHoliday: boolean;
}

export type DayTime = [number, number];

export interface OpeningHour<T = Date> {
    from: T;
    to: T;
}

@Injectable({
    providedIn: 'root'
})
export class OpeningHoursAPI {
    constructor(private http: HttpClient) { }

    getOpeningHours(d?: Date): Observable<OpeningHoursResponse<Date>>;
    getOpeningHours(year: number, month: number, day: number): Observable<OpeningHoursResponse<Date>>;
    getOpeningHours(dOrYear: Date | number, month?: number, day?: number): Observable<OpeningHoursResponse<Date>> {
        let year: number;
        if (dOrYear instanceof Date) {
            year = dOrYear.getFullYear();
            month = dOrYear.getMonth() + 1;
            day = dOrYear.getDate();
        } else {
            year = dOrYear;
        }

        return this.http.get<OpeningHoursResponse<string>>(`/api/openinghours/v1/opening-hours`, {
            params: {
                at: `${year}-${month}-${day}`
            }
        }).pipe(
            map(res => ({
                ...res,
                openingHours: res.openingHours.map(frame => ({
                    from: new Date(frame.from),
                    to: new Date(frame.to),
                }))
            }))
        );
    }
}
