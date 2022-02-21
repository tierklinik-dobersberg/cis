import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface OpeningHoursResponse<T = Date> {
    openingHours: OpeningHour<T>[];
    isHoliday: boolean;
}

export interface OpeningHoursRangeResponse<T = Date> {
    dates: {
        [date: string]: OpeningHoursResponse<T>
    }
}

export type DayTime = [number, number];

export interface OpeningHour<T = Date> {
    from: T;
    to: T;
    unofficial: boolean;
}

@Injectable({
    providedIn: 'root'
})
export class OpeningHoursAPI {
    constructor(private http: HttpClient) { }

    getRange(from: Date, to: Date): Observable<OpeningHoursRangeResponse<Date>> {
        return this.http.get<OpeningHoursRangeResponse<string>>("/api/openinghours/v1/opening-hours", {
            params: {
                from: `${from.getFullYear()}-${from.getMonth() + 1}-${from.getDate()}`,
                to: `${to.getFullYear()}-${to.getMonth() + 1}-${to.getDate()}`,
            }
        }).pipe(
            map(res => {
                let converted: OpeningHoursRangeResponse<Date> = { dates: {} }
                Object.keys(res.dates).forEach(key => {
                    converted.dates[new Date(key).toDateString()] = {
                        ...res.dates[key],
                        openingHours: res.dates[key].openingHours.map(frame => ({
                            from: new Date(frame.from),
                            to: new Date(frame.to),
                            unofficial: frame.unofficial,
                        }))
                    }
                })

                return converted;
            })
        )
    }

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
                    unofficial: frame.unofficial,
                }))
            }))
        );
    }
}
