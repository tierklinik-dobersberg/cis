import { HttpClient, HttpParams } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import { UserService } from "./user.service";
import { IdentityAPI, ProfileWithAvatar } from "./identity.api";

export interface CommentModel {
  _id: string;
  key: string;
  parentID?: string;
  user: string;
  message: string;
  createdAt: string;
  updatedAt: string;
}

export interface Comment extends CommentModel {
  date: Date;
  edited?: boolean;
  profile?: ProfileWithAvatar;
  children?: Comment[];
}

@Injectable({
  providedIn: 'root'
})
export class CommentAPI {
  constructor(
    private http: HttpClient,
    private userService: UserService,
  ) { }

  list(key: string, prefix?: boolean, tree?: boolean): Observable<Comment[]> {
    let params = new HttpParams();
    if (!!prefix) {
      params = params.set("prefix", "true")
    }

    return this.http.get<CommentModel[] | null>(`/api/comments/v1/${key}`, { params })
      .pipe(
        map(result => result || []),
        this.userService.withUserByName('user'),
        map(result => result.map(elem => {
          return {
            ...elem,
            date: new Date(elem.updatedAt),
            edited: elem.createdAt !== elem.updatedAt,
          }
        })),
        map(result => {
          if (!tree) {
            return result;
          }

          let byId = new Map<string, Comment>();
          let roots: Comment[] = [];

          result.forEach(comment => {
            byId.set(comment._id, comment);
          });

          result.forEach(comment => {
            if (comment.parentID !== "000000000000000000000000") {
              let parent = byId.get(comment.parentID);
              if (!!parent) {
                parent.children = [
                  ...(parent.children || []),
                  comment,
                ]
              }
            } else {
              roots.push(comment);
            }
          });

          return roots
        })
      );
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
