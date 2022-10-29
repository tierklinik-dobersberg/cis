import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Profile, ProfileWithAvatar, TkdAccountService, Permission } from '@tkd/api';
import { Observable, of } from 'rxjs';
import {
  map,
  mergeMap, tap
} from 'rxjs/operators';
import { getContrastFontColor } from '../utils';
import { UIConfig } from './config.api';

export interface Action {
  scope: string;
  description: string;
  validatesResourcePath: boolean;
}

export interface Role {
  name: string;
  description: string;
}

export interface RoleDetails extends Role {
  permissions: Permission[] | null;
}
export interface UserDetails extends Profile {
  permissions: Permission[] | null;
}

export interface PasswordStrenght {
  score: number;
  crackTime: string;
  entropy: number;
}

@Injectable({
  providedIn: 'root',
})
export class IdentityAPI {
  private avatarCache: { [key: string]: string } = {};
  private rolesToHide: Set<string> = new Set();

  applyUIConfig(cfg: UIConfig): void {
    this.rolesToHide = new Set();
    cfg?.UI?.HideUsersWithRole?.forEach((role) => this.rolesToHide.add(role));
  }

  constructor(
    private account: TkdAccountService,
    private http: HttpClient,
  ) {}

  /**
   * Changes the password for the given user.
   *
   * @param current The current user password
   * @param newPwd The new user password
   */
  changePassword(current: string, newPwd: string): Observable<void> {
    return this.http.put<void>(`/api/identity/v1/profile/password`, {
      current,
      newPassword: newPwd,
    });
  }

  /**
   * Sets a new password for a user. This is the "admin" version of changePassword
   *
   * @param username The name of the user
   * @param password The new password for the user
   */
  setUserPassword(username: string, password: string): Observable<void> {
    return this.http.put<void>(`/api/identity/v1/users/${username}/password`, {
      password,
    });
  }

  /**
   * Tests if a password is valid.
   *
   * @param password The password to test
   */
  testPassword(password: string): Observable<PasswordStrenght> {
    return this.http.post<PasswordStrenght>(`/api/identity/v1/password-check`, {
      password,
    });
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

    return this.http.get<Profile[]>('/api/identity/v1/users').pipe(
      map((profiles) => {
        if (!filter) {
          return profiles;
        }
        const result = profiles.filter(
          (p) => !p.roles || !p.roles.some((role) => this.rolesToHide.has(role))
        );

        return result;
      }),
      map((profiles) => {
        return profiles.map((p) => {
          return {
            ...p,
            avatar: this.account.avatarUrl(p.name),
            color: p.color || null,
            fontColor: !!p.color ? getContrastFontColor(p.color) : null,
          };
        });
      }),
      map((profiles) => {
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
   *  Returns all available actions
   */
  listActions(): Observable<Action[]> {
    return this.http.get<{actions: Action[]}>(`/api/identity/v1/actions`)
      .pipe(map(result => {
        return result.actions;
      }))
  }

  /**
   * Check if the user has access to url.
   *
   * @param url THe URL to check.
   */
  verifyURL(url: string): Observable<boolean> {
    const headers = new HttpHeaders();
    headers.set('X-Original-URL', url);

    return this.http
      .get('/api/identity/v1/verify', {
        observe: 'response',
        headers,
      })
      .pipe(
        map((resp) => {
          if (!resp.ok) {
            return false;
          }

          return true;
        })
      );
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
    return this.http
      .get(`/api/identity/v1/avatar/${user}`, {
        responseType: 'blob',
      })
      .pipe(
        mergeMap((blob) => {
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
        tap((data) => {
          this.avatarCache[user] = data;
        })
      );
  }

  /**
   * Create a new system user.
   *
   * @param user The user object to create. It may have a password specified as well. If no password
   *             is given a random one will be generated and returned.
   */
  createUser(user: Profile): Observable<void>;
  createUser(
    user: Profile & { password: string }
  ): Observable<{ password: string }>;
  createUser(
    user: Profile & { password?: string }
  ): Observable<{ password: string } | void> {
    return this.http.post<{ password: string } | void>(
      `/api/identity/v1/users/${user.name}`,
      user
    );
  }

  /**
   * Edit a system user.
   *
   * @param user The updated user.
   */
  editUser(user: Profile): Observable<void> {
    return this.http.put<void>(`/api/identity/v1/users/${user.name}`, user);
  }

  /**
   * Uploads a new avatar for a given user.
   *
   * @param user The name of the user
   * @param avatar The {@link File} to send to the server
   */
  uploadUserAvatar(user: string, avatar: File): Observable<void> {
    const formData = new FormData();
    formData.append('file', avatar);
    return this.http.post<void>(`/api/identity/v1/avatar/${user}`, formData);
  }

  /**
   * Returns the details for a user account.
   */
  getUser(username: string): Observable<UserDetails> {
    return this.http.get<UserDetails>(`/api/identity/v1/users/${username}`);
  }

  /**
   * Returns the details for a role.
   */
  getRole(rolename: string): Observable<RoleDetails> {
    return this.http.get<RoleDetails>(`/api/identity/v1/roles/${rolename}`);
  }

  /**
   * Returns a list of all roles.
   */
  getRoles(): Observable<Role[]> {
    return this.http.get<Role[]>(`/api/identity/v1/roles`);
  }

  /**
   * Create a new role
   */
  createRole(role: Role): Observable<void> {
    return this.http.post<void>(`/api/identity/v1/roles/${role.name}`, role);
  }

  /**
   * Edit/Save a role
   */
  editRole(role: Role): Observable<void> {
    return this.http.put<void>(`/api/identity/v1/roles/${role.name}`, role);
  }

  /**
   * Delete a role identified by it's name
   */
  deleteRole(role: string): Observable<void> {
    return this.http.delete<void>(`/api/identity/v1/roles/${role}`);
  }

  /**
   * Assigns a new permission to either a user or a role.
   */
  assignPermission(
    scope: 'users' | 'roles',
    target: string,
    perm: Permission
  ): Observable<{ id: string }> {
    return this.http.post<{ id: string }>(
      `/api/identity/v1/permissions/${scope}/${target}`,
      perm
    );
  }

  /**
   * Removes a permission by ID from either a user or a role.
   */
  unassignPermission(
    scope: 'users' | 'roles',
    target: string,
    permid: string
  ): Observable<{ id: string }> {
    return this.http.delete<{ id: string }>(
      `/api/identity/v1/permissions/${scope}/${target}/${permid}`
    );
  }
}
