import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { toDateString } from '@tierklinik-dobersberg/angular/utils/date';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface BaseVoiceMailRecording {
    _id: string;
    from: string;
    date: string;
    customerID?: number;
    customerSource?: string;
    read?: boolean;
    filename?: string;
    name?: string;
}

export interface SearchParams {
    date?: Date;
    seen?: boolean;
    name?: string;
}

export interface VoiceMailRecording extends BaseVoiceMailRecording {
    url: string;
    localDate: Date;
}

@Injectable({
    providedIn: 'root'
})
export class VoiceMailAPI {
    constructor(private http: HttpClient) { }

    listMailboxes(): Observable<string[]> {
        return this.http.get<string[] | null>('/api/voicemail/v1/list')
            .pipe(map(res => res));
    }

    search(opts: SearchParams): Observable<VoiceMailRecording[]> {
        let params = new HttpParams();

        if (opts.date !== undefined) {
            params = params.set('date', toDateString(opts.date))
        }

        if (opts.name !== undefined) {
            params = params.set(`name`, opts.name);
        }

        if (opts.seen !== undefined) {
            params = params.set(`seen`, `${opts.seen}`);
        }

        return this.http.get<BaseVoiceMailRecording[]>(`/api/voicemail/v1/search`, {
            params
        })
            .pipe(
                map(res => res || []),
                map(res => res.map(r => ({
                    ...r,
                    localDate: new Date(r.date),
                    url: `/api/voicemail/v1/recording/${r._id}`,
                })))
            );
    }

    updateSeen(id: string, seen: boolean): Observable<void> {
        if (seen) {
            return this.http.put<void>(`/api/voicemail/v1/recording/${id}/seen`, null);
        }

        return this.http.delete<void>(`/api/voicemail/v1/recording/${id}/seen`);
    }

    forDate(date: Date, name?: string): Observable<VoiceMailRecording[]> {
        return this.search({
            date,
            name,
        });
    }
}
