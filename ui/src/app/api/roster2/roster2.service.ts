import { HttpClient, HttpParams } from '@angular/common/http';
import { Inject, Injectable, InjectionToken } from '@angular/core';
import { map, Observable } from 'rxjs';
import { toDateString } from 'src/app/utils';
import { formatDate } from 'src/utils/duration';
import { Constraint, DayKinds, JSDuration, OffTime, OnDutyResponse, Roster, RosterAnalysis, RosterMeta, RosterShiftWithStaffList, WorkShift, WorkTime } from './roster2-types';

export const ROSTERD_API = new InjectionToken<string>('ROSTERD_API')

@Injectable({
    providedIn: 'root'
})
export class Roster2Service {
    constructor(
        private http: HttpClient,
        @Inject(ROSTERD_API) private apiURL: string,
    ) {}

    /** Work Time API */
    readonly workTimes = new class {
        constructor(
            private http: HttpClient,
            private apiURL: string
        ){}

        set(workTime: WorkTime): Observable<void> {
            return this.http.post<void>(`${this.apiURL}/v1/worktime/`, workTime)
        }

        history(staff: string): Observable<WorkTime[]> {
            return this.http.get<{history: WorkTime[]}>(`${this.apiURL}/v1/worktime/${staff}/history`)
                .pipe(map(result => result.history))
        }

        current(): Observable<{[username: string]: WorkTime}> {
            interface response {
                workTimes: {
                    [username: string]: WorkTime
                }
            }

            return this.http.get<response>(`${this.apiURL}/v1/worktime/`)
                .pipe(map(result => result.workTimes))
        }

    }(this.http, this.apiURL)

    /** Roster API */
    readonly roster = new class {
        constructor(
            private http: HttpClient,
            private apiURL: string
        ){}

        create(roster: Omit<Roster,'updatedAt'|'updatedBy'|'createdAt'|'createdBy'>): Observable<void> {
          return this.http.post<void>(`${this.apiURL}/v1/roster/${roster.year}/${roster.month}`, roster)
        }

        update(roster: Omit<Roster, 'updatedAt'|'updatedBy'|'createdAt'|'createdBy'>): Observable<void> {
          return this.http.put<void>(`${this.apiURL}/v1/roster/byid/${roster.id}`, roster)
        }

        get(year: number, month: number): Observable<Roster> {
          return this.http.get<Roster>(`${this.apiURL}/v1/roster/${year}/${month}`)
        }

        delete(id: string): Observable<void>{
          return this.http.delete<void>(`${this.apiURL}/v1/roster/byid/${id}`)
        }

        list(): Observable<RosterMeta[]> {
          return this.http.get<RosterMeta[]>(`${this.apiURL}/v1/roster/`)
        }

        onDuty({tags, shortNames, time, date}: {tags?: string[], shortNames?: string[], time?: Date, date?: Date} = {}): Observable<OnDutyResponse> {
          let params = new HttpParams();
          if (!!tags) {
            params = params.appendAll({tags})
          }

          if (!!shortNames) {
            params = params.appendAll({shortNames})
          }

          if (!!time) {
            params = params.set("time", time.toISOString())
          }
          if (!!date) {
            params = params.set("date", toDateString(date))
          }

          return this.http.get<OnDutyResponse>(`${this.apiURL}/v1/roster/on-duty`, {params})
        }

        byId(id: string): Observable<Roster> {
          return this.http.get<Roster>(`${this.apiURL}/v1/roster/byid/${id}`)
        }

        generate(year: number, month: number): Observable<Roster> {
          return this.http.post<{roster: Roster}>(`${this.apiURL}/v1/roster/${year}/${month}/generate`, null)
            .pipe(map(result => result.roster))
        }

        dayKinds(from: Date, to: Date): Observable<DayKinds> {
            return this.http.get<DayKinds>(`${this.apiURL}/v1/roster/utils/daykinds/${formatDate(from)}/${formatDate(to)}`)
        }

        analyze(roster: Omit<Roster,'createdAt'|'createdBy'|'updatedAt'|'updatedBy'>): Observable<RosterAnalysis> {
            return this.http.post<RosterAnalysis>(`${this.apiURL}/v1/roster/analyze`, roster)
        }
    }(this.http, this.apiURL)

    readonly constraints = new class {
        constructor(
            private http: HttpClient,
            private apiURL: string
        ){}

        create(constraint: Constraint): Observable<void> {
            return this.http.post<void>(`${this.apiURL}/v1/constraint/`, constraint);
        }

        update(constraint: Constraint): Observable<void> {
            return this.http.put<void>(`${this.apiURL}/v1/constraint/${constraint.id}`, constraint);
        }

        delete(id: string): Observable<void> {
            return this.http.delete<void>(`${this.apiURL}/v1/constraint/${id}`)
        }

        find(staff?: string[], role?: string[]): Observable<Constraint[]> {
            let params = new HttpParams();

            if (!!staff) {
                staff.forEach(s => params = params.append("staff", s))
            }
            if (!!role) {
                role.forEach(r => params = params.append("role", r))
            }

            return this.http.get<{constraints: Constraint[]}>(`${this.apiURL}/v1/constraint/`, {params})
                .pipe(
                    map(res => res.constraints)
                );
        }

    }(this.http, this.apiURL)

    /** WorkShift API */
    readonly workShifts = new class {
        constructor(
            private http: HttpClient,
            private apiURL: string
        ){}

        list(): Observable<WorkShift[]> {
            interface response {
                workShifts: WorkShift[];
            }

            return this.http.get<response>(`${this.apiURL}/v1/workshift`)
                .pipe(map(result => result.workShifts))
        }

        create(shift: WorkShift): Observable<void> {
            return this.http.post<void>(`${this.apiURL}/v1/workshift`, shift)
        }

        update(shift: WorkShift): Observable<void> {
            return this.http.put<void>(`${this.apiURL}/v1/workshift/${shift.id}`, shift)
        }

        delete(id: string): Observable<void> {
            return this.http.delete<void>(`${this.apiURL}/v1/workshift/${id}` )
        }

        findRequiredShifts(from: Date, to?: Date, tags?: string[], includeRoster = false): Observable<{[date: string]: RosterShiftWithStaffList[]}> {
            if (!to) {
              to = new Date(from.getFullYear(), from.getMonth() + 1, 0)
              from = new Date(from.getFullYear(), from.getMonth(), 1)
            }

            let params = new HttpParams()
                .append("from", toDateString(from))
                .append("to", toDateString(to))
                .append('stafflist', true)

            if (!!tags?.length) {
              params = params.appendAll({'tags': tags})
            }

            if (includeRoster) {
              params = params.set("include-roster", true)
            }

            return this.http.get<{[date: string]: RosterShiftWithStaffList[]}>(`${this.apiURL}/v1/roster/shifts`, {
                params,
            })
        }
    }(this.http, this.apiURL)

    /** Off time request API */
    readonly offTime = new class {
        constructor(
            private http: HttpClient,
            private apiURL: string
        ){}

        create(req: OffTime.CreateRequest): Observable<void> {
            return this.http.post<void>(`${this.apiURL}/v1/offtime/request/`, req)
        }

        credit(staff: string, days: number, description = '', from?: Date): Observable<void> {
            let payload: OffTime.CreateCreditsRequest = {
                description: description,
                staff: staff,
                days: days,
            }

            if (!!from) {
                payload.from = from.toISOString()
            }

            return this.http.post<void>(`${this.apiURL}/v1/offtime/credit/${staff}`, payload)
        }

        delete(id: string): Observable<void> {
            return this.http.delete<void>(`${this.apiURL}/v1/offtime/request/${id}`)
        }

        approve(id: string, usedAsVacation: boolean = false, comment: string = ''): Observable<void> {
            return this.http.post<void>(`${this.apiURL}/v1/offtime/request/${id}/approve`, {comment, usedAsVacation})
        }

        reject(id: string, comment: string = ''): Observable<void> {
            return this.http.post<void>(`${this.apiURL}/v1/offtime/request/${id}/reject`, {comment})
        }

        credits(): Observable<{[user: JSDuration]: number}> {
            return this.http.get<{[user: JSDuration]: number}>(`${this.apiURL}/v1/offtime/credit`)
        }

        findRequests(staff?: string, from?: Date, to?: Date, approved?: boolean): Observable<OffTime.Entry[]> {
            let params = new HttpParams()

            if (!!staff) {
                params = params.append("staff", staff)
            }

            if (!!from) {
                params = params.append("from", formatDate(from))
            }
            if (!!to) {
                params = params.append("to", formatDate(to))
            }
            if (approved !== undefined) {
                params = params.append("approved", approved)
            }

            interface response {
                offTimeRequests: OffTime.Entry[]
            }

            return this.http.get<response>(`${this.apiURL}/v1/offtime/`, {params})
                .pipe(map(result => result.offTimeRequests))
        }

    }(this.http, this.apiURL)
}
