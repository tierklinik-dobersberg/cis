import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import jwt_decode, { JwtPayload as JWTToken } from 'jwt-decode';
import { BehaviorSubject, interval, Observable, of } from 'rxjs';
import { catchError, filter, map, mergeMap, startWith, tap } from 'rxjs/operators';
import { getContrastFontColor } from '../utils';
import { UIConfig } from './config.api';

// Permission defines all API permissions.
export enum Permission {
  CalllogCreateRecord = 'calllog:create',
  CalllogReadRecords = 'calllog:read',
  CommentCreate = 'comment:create',
  CommentRead = 'comment:read',
  CommentReply = 'comment:reply',
  CustomerRead = 'customer:read',
  DoorGet = 'door:get',
  DoorSet = 'door:set',
  ExternalReadOnDuty = 'external:read-on-duty',
  ExternalReadContact = 'external:read-contact',
  ImportNeumayrContacts = 'import:neumayr-contacts',
  RosterWrite = 'roster:write',
  RosterRead = 'roster:read',
  RosterSetOverwrite = 'roster:write:overwrite',
  RosterGetOverwrite = 'roster:read:overwrite',
  VoicemailRead = 'voicemail:read',
  CalendarRead = 'calendar:events:read',
  CalendarWrite = 'calendar:events:write',
  CalendarDelete = 'calendar:events:delete',
  TriggerRead = 'trigger:read',
  TriggerExecute = 'trigger:execute'
}

export interface Profile {
  name: string;
  fullname: string;
  mail: string[];
  phoneNumbers: string[];
  roles: string[];
  properties: {
    [key: string]: any;
  };
  color?: string;
  disabled?: boolean;
  calendarID?: string;
  needsPasswordChange?: boolean;
}

interface TokenReponse {
  token: string;
}

export interface PasswordStrenght {
  score: number;
  crackTime: string;
  entropy: number;
}

export interface ProfileWithAvatar extends Profile {
  avatar?: string;
  color: string | null;
  fontColor: string | null;
}

export interface ProfileWithPermissions extends ProfileWithAvatar {
  permissions: UIPermissions;
}

export interface PermissionRequest {
  user?: string;
  resource?: string;
  action?: string;
}

export interface PermissionTestResult {
  allowed: boolean;
  message?: string;
  error?: string;
}

export type UIPermissions = Partial<Record<Permission, boolean>>;

export interface Token extends JWTToken {
  expiresAt: Date;
  app_metadata: {
    authorization: {
      roles: string[];
    };
  };
}

// TODO(ppacher): move to ui.conf and load from API
const tokenThreshold = 48 * 60 * 60 * 1000;

@Injectable({
  providedIn: 'root'
})
export class IdentityAPI {
  private onLogin = new BehaviorSubject<ProfileWithPermissions | null>(null);
  private avatarCache: { [key: string]: string } = {};
  private rolesToHide: Set<string> = new Set();
  private token: Token | null = null;

  applyUIConfig(cfg: UIConfig): void {
    this.rolesToHide = new Set();
    cfg?.HideUsersWithRole?.forEach(role => this.rolesToHide.add(role));
  }

  constructor(
    private http: HttpClient,
  ) {
    interval(60 * 1000)
      .pipe(
        startWith(-1),
        filter(() => {
          if (!this.token) {
            return true;
          }
          return new Date().valueOf() + tokenThreshold >= this.token.expiresAt.valueOf();
        }),
        mergeMap(() => this.refresh()),
        catchError(err => of<Token | null>(null)),
      )
      .subscribe(token => {
        if (!!token) {
          console.log(`Got new access token: `, token);
        }
        this.token = token || null;
      });

    // Whenever we switch user we need to load the profiles permissions as well.
    this.profileChange
      .pipe(filter(profile => !!profile))
      .subscribe(() => { });

    // Upon creation try to get the user profile to check if we are currently
    // logged in.
    this.profile()
      .subscribe(p => {
        this.onLogin.next(p);
      }, err => console.error(err));
  }

  get profileChange(): Observable<ProfileWithPermissions> {
    return this.onLogin.asObservable();
  }

  get currentProfile(): ProfileWithPermissions | null {
    return this.onLogin.getValue();
  }

  hasPermission(p: Permission): boolean {
    const profile = this.onLogin.getValue();
    return profile?.permissions[p] || false;
  }

  /**
   * Creates a new session for the given user.
   *
   * @param username The name of the user to login.
   * @param password The password of the user.
   */
  login(username: string, password: string, rd: string = ''): Observable<ProfileWithPermissions> {
    let externalRd = '';
    if (rd !== '') {
      externalRd = `?redirect=${rd}`;
    }

    return this.http.post<TokenReponse>(`/api/identity/v1/login${externalRd}`, {
      username,
      password,
    }, {
      observe: 'response',
    })
      .pipe(
        map(resp => {
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
        tap(profile => {
          const last = this.onLogin.getValue();
          if (!last || last.name !== profile.name) {
            this.onLogin.next(profile);
          }
        })
      );
  }

  /**
   * Refresh tries to renew the access token.
   */
  refresh(): Observable<Token> {
    return this.http.post<TokenReponse>(`/api/identity/v1/refresh`, null)
      .pipe(map(r => this.parseToken(r.token)));
  }

  /**
   * Changes the password for the given user.
   *
   * @param current The current user password
   * @param newPwd The new user password
   */
  changePassword(current: string, newPwd: string): Observable<void> {
    return this.http.put<void>(`/api/identity/v1/profile/password`, {
      current,
      newPassword: newPwd
    });
  }


  /**
   * Tests if a password is valid.
   *
   * @param password The password to test
   */
  testPassword(password: string): Observable<PasswordStrenght> {
    return this.http.post<PasswordStrenght>(`/api/identity/v1/password-check`, {
      password
    });
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
  listUsers(opts?: { filter?: boolean }): Observable<ProfileWithAvatar[]> {
    // eslint-disable-next-line @typescript-eslint/no-shadow
    let { filter } = opts || {};

    if (filter === undefined) {
      filter = true;
    }

    return this.http.get<Profile[]>('/api/identity/v1/users')
      .pipe(
        map(profiles => {
          if (!filter) {
            return profiles;
          }
          const result = profiles.filter(p => !p.roles || !p.roles.some(
            role => this.rolesToHide.has(role)
          ));

          return result;
        }),
        map(profiles => {
          return profiles.map(p => {
            return {
              ...p,
              avatar: this.avatarUrl(p.name),
              color: p.color || null,
              fontColor: !!p.color ? getContrastFontColor(p.color) : null,
            };
          });
        }),
        map(profiles => {
          return profiles.sort((a, b) => {
            if (a.fullname > b.fullname) {
              return 1;
            }

            if (b.fullname < a.fullname) {
              return -1;
            }

            return 0;
          });
        })
      );
  }

  /**
   * Check if the user has access to path.
   *
   * @param path The path to check.
   */
  verifyAPI(path: string): Observable<boolean> {
    const scheme = window.location.protocol;
    const host = window.location.host;

    if (!path.startsWith('/')) {
      path = '/' + path;
    }

    return this.verifyURL(`${scheme}//${host}${path}`);
  }

  /**
   * Check if the user has access to url.
   *
   * @param url THe URL to check.
   */
  verifyURL(url: string): Observable<boolean> {
    const headers = new HttpHeaders();
    headers.set('X-Original-URL', url);

    return this.http.get('/api/identity/v1/verify', {
      observe: 'response',
      headers,
    })
      .pipe(
        map(resp => {
          if (!resp.ok) {
            return false;
          }

          return true;
        })
      );
  }

  /** Returns the current user profile. */
  profile(): Observable<ProfileWithPermissions> {
    return this.http.get<Profile>('/api/identity/v1/profile')
      .pipe(
        map(p => {
          return {
            ...p,
            avatar: this.avatarUrl(p.name),
            color: p.color || null,
            fontColor: !!p.color ? getContrastFontColor(p.color) : null,
          };
        }),
        mergeMap(pwa => {
          const request: Partial<Record<Permission, PermissionRequest>> = {};
          const actions: Permission[] = [
            Permission.RosterGetOverwrite,
            Permission.RosterRead,
            Permission.RosterWrite,
            Permission.RosterSetOverwrite,
            Permission.ExternalReadOnDuty,
            Permission.DoorGet,
            Permission.DoorSet,
            Permission.ImportNeumayrContacts,
            Permission.CustomerRead,
            Permission.CalllogReadRecords,
            Permission.VoicemailRead,
            Permission.CalendarDelete,
            Permission.CalendarRead,
            Permission.CalendarWrite,
            Permission.TriggerRead
          ];

          actions.forEach(perm => {
            request[perm] = { action: perm };
          });
          return this.testPerimissions(request)
            .pipe(
              catchError(() => of(null)),
              map(permissions => {
                const p: UIPermissions = {};

                Object.keys(permissions || {}).forEach(perm => {
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
    return `/api/identity/v1/avatar/${user}`;
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

    // we use the current timestamp to avoid browser caching
    // since we already cache those avatars ourself.
    return this.http.get(`/api/identity/v1/avatar/${user}`, {
      responseType: 'blob'
    })
      .pipe(
        mergeMap(blob => {
          return new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              const dataUrl = reader.result as string;
              resolve(dataUrl);
            };
            try {
              reader.readAsDataURL(blob);
            } catch (err) {
              console.error(err, 'blob', blob);
              reject(err);
            }
          });
        }),
        tap(data => {
          this.avatarCache[user] = data;
        })
      );
  }

  testPerimissions<T extends { [key: string]: PermissionRequest }>(requests: T): Observable<{ [key: string]: PermissionTestResult }> {
    return this.http.post<{ [key: string]: PermissionTestResult }>(`/api/identity/v1/permissions/test`, requests);
  }

  private parseToken(token: string): Token {
    const t = jwt_decode<Token>(token);
    return {
      ...t,
      expiresAt: new Date(t.exp * 1000),
    };
  }
}
