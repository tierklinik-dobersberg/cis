import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface RemotePatient {
  _id: string;
  customerSource: string;
  customerID: string;
  size: string;
  species: string;
  breed: string;
  gender: string;
  name: string;
  birthday: string;
  specialDetail: string;
  animalID: string;
  color: string;
  chipNumber: string;
  notes: string[];
}

export type LocalPatient = RemotePatient;

@Injectable({
  providedIn: 'root'
})
export class PatientAPI {
  constructor(private http: HttpClient) { }

  getPatient(source: string, cid: string | number, aid: string): Observable<LocalPatient> {
    return this.http.get<RemotePatient>(`/api/patient/v1/${source}/${cid}/${aid}`);
  }

  getPatientsForCustomer(source: string, cid: string | number): Observable<LocalPatient[]> {
    return this.http.get<RemotePatient[]>(`/api/patient/v1/${source}/${cid}`)
      .pipe(map(res => {
        if (res === null) {
          return [];
        }
        return res;
      }));
  }
}
