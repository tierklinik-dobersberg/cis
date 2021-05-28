import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface TriggerInstance {
    name: string;
    description?: string;
    pending: boolean;
}

interface TriggerListResponse {
    instances: TriggerInstance[];
}

@Injectable({ providedIn: 'root' })
export class TriggerAPI {
    constructor(private http: HttpClient) { }

    /** Returns all available trigger instances */
    listInstances(): Observable<TriggerInstance[]> {
        return this.http.get<TriggerListResponse>(`/api/triggers/v1`)
            .pipe(map(res => res.instances))
    }

    /** Executes the trigger */
    executeInstance(trigger: string): Observable<void> {
        return this.http.post<void>(`/api/triggers/v1/${trigger}`, null)
    }
}