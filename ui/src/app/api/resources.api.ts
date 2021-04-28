import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Resource {
    id: string;
    name: string;
    description?: string;
    location?: string;
    maxConcurrentUse: number;
}

@Injectable({ providedIn: 'root' })
export class ResourceAPI {
    constructor(private http: HttpClient) { }

    listResources(): Observable<Resource[]> {
        return this.http.get<Resource[]>('/api/resources/v1');
    }
}
