import { HttpClient, HttpParams } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Day {
  forenoon: string[];
  afternoon: string[];
  emergency: string[];
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
   *
   * @param year
   * @param month
   */
  forMonth(year: number, month: number): Observable<Roster> {
    return this.http.get<Roster>(`/api/dutyroster/v1/roster/${year}/${month}`)
      .pipe(
        map(result => {
          Object.keys(result.days).forEach(dayKey => {
            const day: Day = result.days[dayKey];

            day.afternoon = day.afternoon || [];
            day.forenoon = day.forenoon || [];
            day.emergency = day.emergency || [];

            result.days[dayKey] = day;
          })
          return result;
        })
      )
  }

  /**
   * Delete the duty roster for the given month in year.
   * 
   * @param year 
   * @param month 
   */
  delete(year: number, month: number): Observable<void> {
    return this.http.delete(`/api/dutyroster/v1/roster/${year}/${month}`)
      .pipe(map(() => { }))
  }

  /**
   * Creates a new duty roster.
   *
   * @param roster The new duty roster.
   */
  create(roster: Roster): Observable<void> {
    return this.http.put(`/api/dutyroster/v1/roster/${roster.year}/${roster.month}`, roster)
      .pipe(map(() => { }))
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
      params.set(`date`, `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`)
    }

    return this.http.post<void>(`/api/dutyroster/v1/overwrite`, overwrite, {
      params: params,
    })
  }

  /**
   * Returns the overwrite for the requeste date (or today).
   * 
   * @param date The date
   */
  getOverwrite(date?: Date): Observable<Overwrite> {
    let params = new HttpParams();

    if (!!date) {
      params.set(`date`, `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`)
    }

    return this.http.get<Overwrite>(`/api/dutyroster/v1/overwrite`, {
      params: params,
    })
  }
}
