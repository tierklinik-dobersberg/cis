import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs/operators';
import { Observable } from 'rxjs';

export interface RemoteEvent {
    _id: string;
    summary: string;
    description?: string;
    startTime: string;
    endTime?: string;
    calendarID: string;
    fullDayEvent?: boolean;
    username?: string;
    calendarName?: string;
    data?: {
        customerSource: string;
        customerID: string;
        animalID?: string;
        requiredResources?: string[];
    };
}

export interface Calendar {
    name?: string;
    _id: string;
    timeZone?: string;
}

export interface LocalEvent extends Omit<Omit<RemoteEvent, 'startTime'>, 'endTime'> {
    startTime: Date;
    endTime?: Date;
}

@Injectable({
    providedIn: 'root'
})
export class CalendarAPI {
    constructor(private http: HttpClient) { }

    listCalendars(): Observable<Calendar[]> {
        return this.http.get<Calendar[]>('/api/calendar/v1/');
    }

    listEvents(day?: Date, users?: string[]): Observable<LocalEvent[]> {
        const params = {};
        if (!!day) {
            params['for-day'] = `${day.getFullYear()}-${day.getMonth() + 1}-${day.getDate()}`;
        }
        if (Array.isArray(users)) {
            params['for-user'] = users;
        }
        return this.http.get<RemoteEvent[]>(`/api/calendar/v1/events`, {
            params
        }).pipe(
            map(remoteEvents => remoteEvents.map(event => ({
                ...event,
                startTime: new Date(event.startTime),
                endTime: !!event.endTime ? new Date(event.endTime) : undefined,
            })))
        );
    }
}
