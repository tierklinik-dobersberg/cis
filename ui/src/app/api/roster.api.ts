import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export interface OverwriteMeta {
  _id: string;
  createdBy: string;
  createdAt: string;
}

export interface OverwriteBody {
  from: string;
  to: string;
  userId?: string;
  phoneNumber?: string;
  displayName?: string;
  deleted?: boolean;
}

export type Overwrite = OverwriteMeta & OverwriteBody;

@Injectable({
  providedIn: 'root',
})
export class RosterAPI {
  constructor(private http: HttpClient) {}

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
  getActiveOverwrite(date?: Date): Observable<Overwrite | null> {
    let params = new HttpParams();
    if (!!date) {
      params = params.set(`date`, date.toISOString());
    }
    return this.http.get<Overwrite | null>(`/api/dutyroster/v1/overwrite`, {
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
        .set('to', to.toISOString()),
    });
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
    let id: string = '';
    if (typeof oid === 'string') {
      id = oid;
    } else {
      id = oid._id;
    }

    return this.http.delete<void>(`/api/dutyroster/v1/overwrite/${id}`);
  }
}
