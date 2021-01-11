import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export interface DoctorOnDuty {
    username: string;
    fullname: string;
    phone: string;
}

@Injectable({
    providedIn: 'root'
})
export class ExternalAPI {
    constructor(private http: HttpClient) { }

    /**
     * Returns a list of all doctors on duty. The first entry is
     * considered the primary and the others are considered backups.
     */
    getDoctorsOnDuty(): Observable<DoctorOnDuty[]> {
        return this.http.get<DoctorOnDuty[]>("/api/external/v1/doctor-on-duty")
    }
}