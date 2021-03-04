import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export type DoorState = 'locked' | 'unlocked';

export interface TestResult {
  desiredState: DoorState;
  until: Date;
}

interface RemoteTestResult {
  desiredState: DoorState;
  until: string;
}

export interface State {
  state: DoorState;
  until: Date;
  resetInProgress?: boolean;
}

interface RemoteState {
  state: DoorState;
  until: string;
  resetInProgress?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class DoorAPI {
  constructor(private http: HttpClient) { }

  /**
   * Tests which door state would be active at the given time and date.
   */
  test(year: number, month: number, day: number, hour: number, minute: number): Observable<TestResult> {
    return this.http.get<RemoteTestResult>(`api/door/v1/${year}/${month}/${day}/${hour}/${minute}`)
      .pipe(
        map(resp => {
          return {
            desiredState: resp.desiredState,
            until: new Date(resp.until),
          };
        })
      );
  }

  /**
   * Returns the current state of the door.
   */
  state(): Observable<State> {
    return this.http.get<RemoteState>(`api/door/v1/state`)
      .pipe(
        map(resp => {
          return {
            state: resp.state,
            until: new Date(resp.until),
            resetInProgress: resp.resetInProgress,
          };
        })
      );
  }

  /**
   * Reset the door.
   */
  reset(): Observable<State> {
    return this.http.post<RemoteState>(`/api/door/v1/reset`, '')
      .pipe(
        map(resp => {
          return {
            state: resp.state,
            until: new Date(resp.until),
          };
        })
      );
  }

  /**
   * Overwrite the current door state for a given amount of time.
   *
   * @param state The new door state
   * @param duration THe duration for the overwrite. Follows golang time.Duration string
   */
  overwrite(state: 'lock' | 'unlock', duration: string | number): Observable<State> {
    return this.http.post<RemoteState>(`/api/door/v1/overwrite`, {
      state,
      duration,
    })
      .pipe(
        map(resp => {
          return {
            state: resp.state,
            until: new Date(resp.until),
          };
        })
      );
  }
}

