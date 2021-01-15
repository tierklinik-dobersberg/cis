import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable({
    providedIn: 'root'
})
export class DxrService {
    private _studyCache: any | null = null;
    constructor(private http: HttpClient) { }

    loadLastStudies(offset: number = 0, limit: number = 10): Observable<any[]> {
        return this.http.get<any[]>(`/api/dxray/v1/list`, {
            params: {
                offset: offset + '',
                limit: limit + ''
            }
        })
    }

    loadStudy(id: string, refresh: boolean = false): Observable<any> {
        if (!refresh && !!this._studyCache && this._studyCache.studyInstanceUid === id) {
            return of(this._studyCache);
        }

        return this.http.get<any>(`/api/dxray/v1/ohif/${id}`)
            .pipe(tap(study => this._studyCache = study));
    }

    search(searchTerm: string): Observable<any[]> {
        return this.http.get<any[]>(`/api/dxray/v1/search`, {
            params: {
                q: searchTerm,
            }
        });
    }

    getThumbnailUrl(wadoURI: string): string {
        const scheme = window.location.protocol.startsWith('https') ? 'https://' : 'http://';

        return wadoURI.replace('dicomweb://', scheme) + '&contentType=image/jpeg';
    }
}
