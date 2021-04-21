import { HttpClient, HttpParams } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface OnCall {
  day: string[];
  night: string[];
}

export interface Day {
  forenoon: string[];
  afternoon: string[];
  onCall: OnCall;
}

export interface Roster {
  _id?: string;
  month: number;
  year: number;
  days: {
    [key: number]: Day;
  };
}

export interface Overwrite {
  displayName?: string;
  username?: string;
  phoneNumber?: string;
}

@Injectable({
  providedIn: 'root'
})
export class RosterAPI {
  constructor(private http: HttpClient) { }

  /**
   * Returns the duty roster for the given month in year.
   */
  forMonth(): Observable<Roster>;
  forMonth(d: Date): Observable<Roster>;
  forMonth(year: number, month: number): Observable<Roster>;
  forMonth(yearOrDate?: number | Date, month?: number): Observable<Roster> {
    let year: number;
    if (yearOrDate === undefined) {
      yearOrDate = new Date();
    }
    if (yearOrDate instanceof Date) {
      year = yearOrDate.getFullYear();
      month = yearOrDate.getMonth() + 1;
    } else {
      year = yearOrDate;
    }


    return this.http.get<Roster>(`/api/dutyroster/v1/roster/${year}/${month}`)
      .pipe(
        map(result => {
          Object.keys(result.days).forEach(dayKey => {
            const day: Day = result.days[dayKey];

            day.afternoon = day.afternoon || [];
            day.forenoon = day.forenoon || [];
            day.onCall.day = day.onCall.day || [];
            day.onCall.night = day.onCall.night || [];

            result.days[dayKey] = day;
          });
          return result;
        })
      );
  }

  /**
   * Delete the duty roster for the given month in year.
   */
  delete(year: number, month: number): Observable<void> {
    return this.http.delete(`/api/dutyroster/v1/roster/${year}/${month}`)
      .pipe(map(() => { }));
  }

  /**
   * Creates a new duty roster.
   *
   * @param roster The new duty roster.
   */
  create(roster: Roster): Observable<void> {
    return this.http.put(`/api/dutyroster/v1/roster/${roster.year}/${roster.month}`, roster)
      .pipe(map(() => { }));
  }

  /**
   * Creates a new duty roster overwrite for the given date.
   *
   * @param overwrite The overwrite for the duty roster
   * @param date The requested date.
   */
  setOverwrite(overwrite: Overwrite, date?: Date): Observable<void> {
    let params = new HttpParams();

    if (!!date) {
      params = params.set(`date`, `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`);
    }

    return this.http.post<void>(`/api/dutyroster/v1/overwrite`, overwrite, {
      params,
    });
  }

  /**
   * Returns the overwrite for the requested date. Defaults to today.
   *
   * @param date The date
   */
  getOverwrite(date?: Date): Observable<Overwrite> {
    let params = new HttpParams();

    if (!!date) {
      params = params.set(`date`, `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`);
    }

    return this.http.get<Overwrite>(`/api/dutyroster/v1/overwrite`, {
      params,
    });
  }

  /**
   * Deletes the overwrite forthe requested date. Defaults to today.
   *
   * @param date The date
   */
  deleteOverwrite(date?: Date): Observable<void> {
    let params = new HttpParams();

    if (!!date) {
      params = params.set(`date`, `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`);
    }

    return this.http.delete<void>(`/api/dutyroster/v1/overwrite`, {
      params,
    });
  }
}
