import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, tap } from 'rxjs/operators';

export interface Study {
  studyInstanceUid?: string;
  studyDate?: string;
  studyTime?: string;
  patientName?: string;
  patientAge?: string;
  patientBirthDate?: string;
  patientId?: string;
  patientSex?: string;
  animalRace?: string;
  animalName?: string;
  seriesList?: Series[];
}

export interface Series {
  seriesDescription?: string;
  seriesInstanceUid?: string;
  seriesBodyPart?: string;
  seriesNumber?: string;
  seriesDate?: string;
  seriesTime?: string;
  seriesModality?: string;
  instances?: Instance[];
}

export interface Instance {
  instanceNumber?: string;
  sopInstanceUid?: string;
  url?: string;

  [key: string]: any;
}

@Injectable({
  providedIn: 'root'
})
export class DxrService {
  private studyCache: any | null = null;
  constructor(private http: HttpClient) { }

  loadLastStudies(offset: number = 0, limit: number = 10): Observable<Study[]> {
    return this.http.get<any[]>(`/api/dxray/v1/list`, {
      params: {
        offset: offset + '',
        limit: limit + ''
      }
    }).pipe(map(result => result || []));
  }

  loadStudy(id: string, refresh: boolean = false): Observable<any> {
    if (!refresh && !!this.studyCache && this.studyCache.studyInstanceUid === id) {
      return of(this.studyCache);
    }

    return this.http.get<any>(`/api/dxray/v1/ohif/${id}`)
      .pipe(tap(study => this.studyCache = study));
  }

  search(searchTerm: string): Observable<Study[]> {
    return this.http.get<any[]>(`/api/dxray/v1/search`, {
      params: {
        q: searchTerm,
      }
    }).pipe(map(result => result || []));
  }

  getThumbnailUrl(wadoURI: string): string {
    const scheme = window.location.protocol.startsWith('https') ? 'https://' : 'http://';

    return wadoURI.replace('dicomweb://', scheme) + '&contentType=image/jpeg';
  }
}
