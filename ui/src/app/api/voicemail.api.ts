import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";

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
        return this.http.get<string[] | null>("/api/voicemail/v1/list")
            .pipe(map(res => res));
    }

    forDate(date: Date, mailbox: string = ''): Observable<VoiceMailRecording[]> {
        let nameParam = mailbox === '' ? '' : `&name=${mailbox}`
        return this.http.get<BaseVoiceMailRecording[]>(`/api/voicemail/v1/search?date=${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}${nameParam}`)
            .pipe(
                map(res => res || []),
                map(res => res.map(r => ({
                    ...r,
                    localDate: new Date(r.date),
                    url: `/api/voicemail/v1/recording/${r._id}`,
                })))
            )
    }
}