import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { UserService } from './user.service';

export interface DoctorOnDuty {
  username: string;
  fullname: string;
  phone: string;
  properties?: {
    [key: string]: any;
  };
}

export interface DoctorOnDutyResponse<T = Date> {
  doctors: DoctorOnDuty[];
  until: T;
  isOverwrite: boolean;
  isNightShift: boolean;
  isDayShift: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ExternalAPI {
  constructor(
    private http: HttpClient,
    private userService: UserService,
  ) { }

  /**
   * Returns a list of all doctors on duty. The first entry is
   * considered the primary and the others are considered backups.
   */
  getDoctorsOnDuty({at, ignoreOverwrite}: {at?: Date, ignoreOverwrite?: boolean} = {}): Observable<DoctorOnDutyResponse<Date>> {
    let params = new HttpParams();
    if (!!at) {
      params = params.set("at", at.toISOString())
    }
    if (ignoreOverwrite !== undefined) {
      params = params.set("ignore-overwrite", `${ignoreOverwrite}`);
    }
    return this.http.get<DoctorOnDutyResponse<string>>('/api/external/v1/doctor-on-duty', {params})
      .pipe(
        map(res => {
          return {
            ...res,
            until: new Date(res.until),
            doctors: this.userService.extendByName(res.doctors || [], 'username'),
          };
        }),
      );
  }
}
