import { HttpClient, HttpParams } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface OnCall {
  day: string[];
  dayStart?: string;
  night: string[];
  nightStart?: string;
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

export interface OverwriteMeta {
  _id: string;
  createdBy: string;
  createdAt: string;
}

export interface OverwriteBody {
  from: string;
  to: string;
  username?: string;
  phoneNumber?: string;
  displayName?: string;
  deleted?: boolean;
}

export type Overwrite = OverwriteMeta & OverwriteBody;

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

  forDay(): Observable<Day>;
  forDay(d: Date): Observable<Day>;
  forDay(year: number, month: number, day: number): Observable<Day>;
  forDay(yearOrDate?: number | Date, month?: number, day?: number ): Observable<Day> {
    let year: number;
    if (yearOrDate === undefined) {
      yearOrDate = new Date();
    }
    if (yearOrDate instanceof Date) {
      year = yearOrDate.getFullYear();
      month = yearOrDate.getMonth() +1;
      day = yearOrDate.getDate();
    } else {
      year = yearOrDate;
    }

    return this.http.get<Day>(`/api/dutyroster/v1/roster/${year}/${month}/${day}`)
      .pipe(
        map(result => {
          result.afternoon = result.afternoon || [];
          result.forenoon = result.forenoon || [];
          result.onCall.day = result.onCall.day || [];
          result.onCall.night = result.onCall.night || [];
          return result;
        })
      )
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
  setOverwrite(overwrite: OverwriteBody): Observable<void> {
    return this.http.post<void>(`/api/dutyroster/v1/overwrite`, overwrite);
  }

  /**
   * Returns the overwrite for the requested date. Defaults to today.
   *
   * @param date The date
   */
  getActiveOverwrite(date?: Date): Observable<Overwrite|null> {
    let params = new HttpParams();
    if (!!date) {
      params = params.set(`date`, date.toISOString())
    }
    return this.http.get<Overwrite|null>(`/api/dutyroster/v1/overwrite`, {
      params,
    });
  }

  /**
   * Queries all duty roster overwrites that are effective between from
   * and to.
   * 
   * @param from The lower date boundary for the query
   * @param to  The upper date boundary for the query
   * 
   * @returns A list of overwrites that are effective between from and to.
   */
  getOverwrites(from: Date, to: Date): Observable<Overwrite[]> {
    return this.http.get<Overwrite[]>(`/api/dutyroster/v1/overwrites`, {
      params: new HttpParams()
        .set('from', from.toISOString())
        .set('to', to.toISOString())
    })
  }

  /**
   * Deletes the overwrite forthe requested date. Defaults to today.
   *
   * @param date The date
   */
  deleteOverwrite(date: Date): Observable<void> {
    let params = new HttpParams();

    if (!!date) {
      params = params.set(`date`, date.toISOString());
    }

    return this.http.delete<void>(`/api/dutyroster/v1/overwrite`, {
      params,
    });
  }

  /**
   * Deletes an overwrite by it's unique identifier.
   * 
   * @param oid The overwrite object or the ID of the overwrite
   */
  deleteOverwriteById(oid: Overwrite | string): Observable<void> {
    let id: string ='';
    if (typeof oid === 'string') {
      id = oid;
    } else {
      id = oid._id;
    }

    return this.http.delete<void>(`/api/dutyroster/v1/overwrite/${id}`)
  }
}
