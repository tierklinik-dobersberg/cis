import { HttpClient } from "@angular/common/http";
import { Inject, Injectable } from "@angular/core";
import jwt_decode from 'jwt-decode';
import { BehaviorSubject, catchError, filter, interval, map, mergeMap, Observable, of, startWith, tap } from "rxjs";
import { TKD_CIS_ENDPOINT } from "../common/tokens";
import { Profile, ProfileWithPermissions, Token, TokenResponse, Permissions, PermissionRequest, PermissionTestResult, UIPermissions } from "./account.types";

const tokenThreshold = 30 * 1000;

@Injectable({ providedIn: 'root' })
export class TkdAccountService {
    private onLogin = new BehaviorSubject<ProfileWithPermissions | null>(null);
    private token: Token | null = null;

    constructor(
        @Inject(TKD_CIS_ENDPOINT) private api: string,
        private http: HttpClient,
    ) {
    interval(10 * 1000)
      .pipe(
        startWith(-1),
        filter(() => {
          if (!this.token) {
            return true;
          }
          return (
            new Date().valueOf() + tokenThreshold >=
            this.token.expiresAt.valueOf()
          );
        }),
        mergeMap(() => this.refresh()),
        catchError((err) => of<Token | null>(null))
      )
      .subscribe((token) => {
        if (!!token) {
          console.log(`Got new access token: `, token);
        }
        this.token = token || null;
      });

    // Upon creation try to get the user profile to check if we are currently
    // logged in.
    this.profile().subscribe(
      (p) => {
        this.onLogin.next(p);
      },
      (err) => console.error(err)
    );

    }

  get profileChange(): Observable<ProfileWithPermissions> {
    return this.onLogin.asObservable();
  }

  get currentProfile(): ProfileWithPermissions | null {
    return this.onLogin.getValue();
  }

  hasPermission(p: Permissions): boolean {
    const profile = this.onLogin.getValue();
    return profile?.permissions[p] || false;
  }
  
    /**
     * Creates a new session for the given user.
     *
     * @param username The name of the user to login.
     * @param password The password of the user.
     */
    login(
        username: string,
        password: string,
        rd: string = ''
    ): Observable<ProfileWithPermissions> {
        let externalRd = '';
        if (rd !== '') {
            externalRd = `?redirect=${rd}`;
        }

        return this.http
            .post<TokenResponse>(
                `${this.api}/api/identity/v1/login${externalRd}`,
                {
                    username,
                    password,
                },
                {
                    observe: 'response',
                }
            )
            .pipe(
                map((resp) => {
                    if (!resp.ok) {
                        throw resp;
                    }

                    if (externalRd === '') {
                        // try to decode the token but ingore any error
                        // as only auto-refresh won't work then
                        try {
                            this.token = this.parseToken(resp.body?.token || '');
                            console.log(`Got token`, this.token);
                        } catch (err) {
                            console.error(`Failed to parse token: `, err);
                            this.token = null;
                        }
                    }

                    return undefined;
                }),
                mergeMap(() => this.profile()),
                tap((profile) => {
                    const last = this.onLogin.getValue();
                    if (!last || last.name !== profile.name) {
                        this.onLogin.next(profile);
                    }
                })
            );
    }

    /** Returns the current user profile. */
    profile(): Observable<ProfileWithPermissions> {
        return this.http.get<Profile>(`${this.api}/api/identity/v1/profile`).pipe(
            map((p) => {
                return {
                    ...p,
                    avatar: this.avatarUrl(p.name),
                    color: p.color || null,
                    fontColor: !!p.color ? getContrastFontColor(p.color) : null,
                };
            }),
            mergeMap((pwa) => {
                const request: Partial<Record<Permissions, PermissionRequest>> = {};
                const actions: Permissions[] = [
                    Permissions.RosterGetOverwrite,
                    Permissions.RosterRead,
                    Permissions.RosterWrite,
                    Permissions.RosterSetOverwrite,
                    Permissions.ExternalReadOnDuty,
                    Permissions.DoorGet,
                    Permissions.DoorSet,
                    Permissions.ImportNeumayrContacts,
                    Permissions.CustomerRead,
                    Permissions.CalllogReadRecords,
                    Permissions.VoicemailRead,
                    Permissions.CalendarDelete,
                    Permissions.CalendarRead,
                    Permissions.CalendarWrite,
                    Permissions.TriggerRead,
                    Permissions.InfoScreenShowsRead,
                    Permissions.InfoScreenShowWrite,
                    Permissions.InfoScreenShowDelete,
                    Permissions.SuggestionRead,
                    Permissions.SuggestionApply,
                ];

                actions.forEach((perm) => {
                    request[perm] = { action: perm };
                });
                return this.testPermissions(request).pipe(
                    catchError(() => of(null)),
                    map((permissions) => {
                        const p: UIPermissions = {};

                        Object.keys(permissions || {}).forEach((perm) => {
                            p[perm] = permissions[perm].allowed;
                        });

                        return {
                            ...pwa,
                            permissions: p,
                        };
                    })
                );
            })
        );
    }

    avatarUrl(user: string): string {
        return `${this.api}/api/identity/v1/avatar/${user}`;
    }

    testPermissions<T extends { [key: string]: PermissionRequest }>(
        requests: T
    ): Observable<{ [key: string]: PermissionTestResult }> {
        return this.http.post<{ [key: string]: PermissionTestResult }>(
            `${this.api}/api/identity/v1/permissions/test`,
            requests
        );
    }

    /**
     * Log out of the current session by clearing the session
     * token.
     */
    logout(): Observable<void> {
        return this.http
            .post<void>(`${this.api}/api/identity/v1/logout`, null)
            .pipe(tap(() => this.onLogin.next(null)));
    }

    /**
     * Refresh tries to renew the access token.
     */
    refresh(): Observable<Token> {
        return this.http
            .post<TokenResponse>(`${this.api}/api/identity/v1/refresh`, null)
            .pipe(map((r) => this.parseToken(r.token)));
    }

    private parseToken(token: string): Token {
        const t = jwt_decode<Token>(token);
        return {
            ...t,
            expiresAt: new Date(t.exp * 1000),
        };
    }
}

function parseColor(input: string): number[] {
    if (input.substr(0, 1) === '#') {
        const collen = (input.length - 1) / 3;
        const fact = [17, 1, 0.062272][collen - 1];
        return [
            Math.round(parseInt(input.substr(1, collen), 16) * fact),
            Math.round(parseInt(input.substr(1 + collen, collen), 16) * fact),
            Math.round(parseInt(input.substr(1 + 2 * collen, collen), 16) * fact),
        ];
    }

    return input
        .split('(')[1]
        .split(')')[0]
        .split(',')
        .map((x) => +x);
}

function getContrastFontColor(bgColor: string): string {
    // if (red*0.299 + green*0.587 + blue*0.114) > 186 use #000000 else use #ffffff
    // based on https://stackoverflow.com/a/3943023

    let col = bgColor;
    if (bgColor.startsWith('#') && bgColor.length > 7) {
        col = bgColor.slice(0, 7);
    }
    const [r, g, b] = parseColor(col);

    if (r * 0.299 + g * 0.587 + b * 0.114 > 186) {
        return '#000000';
    }

    return '#ffffff';
}