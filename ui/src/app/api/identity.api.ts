import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { faBowlingBall } from '@fortawesome/free-solid-svg-icons';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { flatMap, map, mergeMap, tap } from 'rxjs/operators';

export interface Profile {
  name: string;
  fullname: string;
  mail: string[];
  phoneNumbers: string[];
  roles: string[];
  properties: {
    [key: string]: any;
  };
}

@Injectable({
  providedIn: 'root'
})
export class IdentityAPI {
  private onLogin = new BehaviorSubject<Profile | null>(null);
  private avatarCache: { [key: string]: string } = {};

  constructor(
    private http: HttpClient,
    private router: Router,
  ) {
    this.profile()
      .subscribe(p => {
        this.onLogin.next(p);
      }, err => console.error(err))
  }

  get profileChange() {
    return this.onLogin.asObservable();
  }

  /**
   * Creates a new session for the given user.
   *
   * @param username The name of the user to login.
   * @param password The password of the user.
   */
  login(username: string, password: string, rd: string = ''): Observable<Profile> {
    let externalRd = '';
    if (rd != '') {
      externalRd = `?redirect=${rd}`
    }

    return this.http.post(`/api/identity/v1/login${externalRd}`, {
      username: username,
      password: password,
    }, {
      observe: 'response',
      responseType: 'text',
    })
      .pipe(
        map(resp => {
          if (!resp.ok) {
            throw resp;
          }

          return undefined;
        }),
        mergeMap(() => this.profile()),
        tap(profile => {
          let last = this.onLogin.getValue();
          if (!last || last.name !== profile.name) {
            this.onLogin.next(profile);
          }
        })
      )
  }

  /**
   * Log out of the current session by clearing the session
   * token.
   */
  logout(): Observable<void> {
    return this.http.post<void>('/api/identity/v1/logout', null)
      .pipe(
        tap(() => this.onLogin.next(null))
      );
  }

  /**
   * Returns all users stored at cisd.
   */
  listUsers(): Observable<Profile[]> {
    return this.http.get<Profile[]>("/api/identity/v1/users")
  }

  /**
   * Check if the user has access to path.
   *
   * @param path The path to check.
   */
  verifyAPI(path: string): Observable<boolean> {
    const scheme = window.location.protocol;
    const host = window.location.host; 1

    if (!path.startsWith("/")) {
      path = "/" + path;
    }

    return this.verifyURL(`${scheme}//${host}${path}`)
  }

  /**
   * Check if the user has access to url.
   *
   * @param url THe URL to check.
   */
  verifyURL(url: string): Observable<boolean> {
    const headers = new HttpHeaders();
    headers.set("X-Original-URL", url);

    return this.http.get("/api/identity/v1/verify", {
      observe: 'response',
      headers: headers,
    })
      .pipe(
        map(resp => {
          if (!resp.ok) {
            return false;
          }

          return true;
        })
      )
  }

  /** Returns the current user profile. */
  profile(): Observable<Profile> {
    return this.http.get<Profile>("/api/identity/v1/profile")
  }

  /**
   * Load a user avatar.
   *
   * @param user The name of the user to load the avatar from.
   */
  avatar(user: string): Observable<string> {
    if (!!this.avatarCache[user]) {
      return of(this.avatarCache[user]);
    }

    return this.http.get("/api/identity/v1/avatar/" + user, {
      responseType: 'blob'
    })
      .pipe(
        mergeMap(blob => {
          return new Promise<string>(resolve => {
            let reader = new FileReader();
            reader.onload = function () {
              let dataUrl = reader.result as string;
              resolve(dataUrl);
            };
            reader.readAsDataURL(blob);
          });
        }),
        tap(data => {
          this.avatarCache[user] = data;
        })
      )
  }
}
