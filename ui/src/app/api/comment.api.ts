import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";

export interface Comment {
    _id: string;
    key: string;
    parentID?: string;
    user: string;
    message: string;
    createdAt: string;
    updatedAt: string;
}

@Injectable({
    providedIn: 'root'
})
export class CommentAPI {
    constructor(private http: HttpClient) { }

    list(key: string): Observable<Comment[]> {
        return this.http.get<Comment[] | null>(`/api/comments/v1/${key}`)
            .pipe(map(result => result || []));
    }

    create(key: string, message: string): Observable<void> {
        return this.http.post<void>(`/api/comments/v1/${key}`, message)
            .pipe(map(() => { }))
    }

    reply(id: string, message: string): Observable<void> {
        return this.http.put<void>(`/api/comments/v1/comment/${id}/replies`, message)
            .pipe(map(() => { }))
    }
}