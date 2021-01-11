import { HttpClient } from '@angular/common/http';
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
    return this.http.get<Roster>(`/api/dutyroster/v1/${year}/${month}`)
  }

  /**
   * Creates a new duty roster.
   *
   * @param roster The new duty roster.
   */
  create(roster: Roster): Observable<void> {
    return this.http.put(`/api/dutyroster/v1/${roster.year}/${roster.month}`, roster)
      .pipe(map(() => { }))
  }
}
