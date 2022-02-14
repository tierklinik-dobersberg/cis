import { Injectable } from '@angular/core';
import { BehaviorSubject, combineLatest, Observable, OperatorFunction } from 'rxjs';
import { delay, filter, map, mergeMap, retryWhen, take } from 'rxjs/operators';
import { IdentityAPI, Profile, ProfileWithAvatar } from './identity.api';
import { ConfigAPI } from './config.api';

/**
 * UserService keeps a list of all users to be used
 * across the web-application.
 */
@Injectable({
  providedIn: 'root'
})
export class UserService {
  /** Used to notify subscribers about new user data. */
  private updated$ = new BehaviorSubject<boolean>(false);

  /** Users indexed by name */
  private usersByName: Map<string, ProfileWithAvatar> = new Map();

  /** Users indexed by phone-extension */
  private usersByExtension: Map<string, ProfileWithAvatar> = new Map();

  /** Users indexed by calendar ID */
  private usersByCalendarID: Map<string, ProfileWithAvatar> = new Map();

  /** Emits whenever users have been reloaded */
  get updated(): Observable<void> {
    return this.updated$.asObservable()
      .pipe(
        filter(loaded => !!loaded),
        map(() => { }),
      );
  }

  /** Emits all users */
  get users(): Observable<ProfileWithAvatar[]> {
    return this.updated.pipe(map(() => Array.from(this.usersByName.values())));
  }

  /** Returns all users */
  get snapshot(): ProfileWithAvatar[] {
    return Array.from(this.usersByName.values())
  }

  private reload$ = new BehaviorSubject<void>(undefined);

  /** Force a reload of all available users. */
  reloadUsers() {
    this.reload$.next();
  }

  constructor(
    private identityapi: IdentityAPI,
    private configapi: ConfigAPI
  ) {
    combineLatest([this.configapi.change, this.reload$])
      .pipe(
        filter(([cfg]) => !!cfg),
        mergeMap(() => this.identityapi.listUsers()),
        retryWhen(err => err.pipe(delay(2000))),
      )
      .subscribe(
        users => this.updateUsers(users),
      );
  }

  /**
   * Returns the user by username.
   *
   * @param username The username to search for
   */
  byName(username: string): ProfileWithAvatar | null {
    return this.usersByName.get(username) || null;
  }

  /**
   * Returns the user by "phone" extension.
   *
   * @param ext The user extension to search for.
   */
  byExtension(ext: string): ProfileWithAvatar | null {
    return this.usersByExtension.get(ext) || null;
  }

  /**
   * Returns the user by "calendar" id.
   *
   * @param id The ID of the calendar
   * @returns
   */
  byCalendarID(id: string): ProfileWithAvatar | null {
    return this.usersByCalendarID.get(id) || null;
  }

  /**
   * Returns a list of user profiles that have roleName.
   *
   * @param roleName The name of the role
   */
  byRole(roleName: string): ProfileWithAvatar[] {
    return Array.from(this.usersByName.values())
      .filter(user => user.roles?.includes(roleName))
  }

  /**
   * Updates the internal maps to search for users.
   *
   * @param users The list of users loaded from CIS.
   */
  private updateUsers(users: ProfileWithAvatar[]): void {
    this.usersByExtension = new Map();
    this.usersByName = new Map();
    this.usersByCalendarID = new Map();

    const cfg = this.configapi.current;
    const phoneExtension = cfg?.UserPhoneExtensionProperties || [];
    users.forEach(user => {
      this.usersByName.set(user.name, user);
      if (!!user.calendarID) {
        this.usersByCalendarID.set(user.calendarID, user);
      }

      phoneExtension.forEach(ext => {
        const value = user.properties[ext];
        if (!!value) {
          this.usersByExtension.set(value, user);
        }
      });
    });

    this.updated$.next(true);
  }

  extendList<T, K extends string>(list: T[], getUser: ((e: T) => ProfileWithAvatar), val: K):
    (T & { [key in typeof val]?: ProfileWithAvatar })[] {

    return list.map(elem => this.extendRecord(elem, getUser, val));
  }

  extendRecord<T, K extends string>(elem: T, getUser: ((e: T) => ProfileWithAvatar), val: K):
    T & { [key in typeof val]?: ProfileWithAvatar } {
    const user = getUser(elem);
    return {
      ...elem,
      [val]: user,
    } as any;
  }

  /**
   * Extends each element in list with the user profile that is
   * referenced by the elements [userNameProp] property.
   *
   * @param list The list of records to extend.
   * @param userNameProp The name of the element property that holds
   *                     the username or a function to retrieve it
   */
  extendByName<T, K extends string = 'profile'>(list: T[], userNameProp: keyof T | ((x: T) => string), val?: K):
    (T & { [key in typeof val]?: ProfileWithAvatar })[] {
    let getUsername: (x: T) => ProfileWithAvatar;

    if (typeof userNameProp === 'string') {
      getUsername = x => this.byName(x[userNameProp as string]);
    } else {
      getUsername = x => this.byName((userNameProp as any)(x));
    }

    return this.extendList(list, getUsername, val || 'profile');
  }

  /**
   * Extends each element in list with the user profile that is
   * referenced by the elements [userExtProp] property.
   *
   * @param list The list of records to extend.
   * @param userExtProp The name of the element property that holds
   *                    the extension or a function to retrieve it
   */
  extendByExtension<T, K extends string = 'profile'>(list: T[], userExtProp: keyof T | ((x: T) => string), val?: K):
    (T & { [key in typeof val]?: ProfileWithAvatar })[] {
    let getExtension: (x: T) => ProfileWithAvatar;

    if (typeof userExtProp === 'string') {
      getExtension = x => this.byExtension(x[userExtProp as string]);
    } else {
      getExtension = x => this.byExtension((userExtProp as any)(x));
    }

    return this.extendList(list, getExtension, val || 'profile');
  }

  /**
   * Like extendByName but operates on an observable
   *
   * @param name The name of the property that holds the username
   * @param val The name of the new property that should hold the profile
   * @returns
   */
  withUserByName<T, K extends string = 'profile'>(name: keyof T | ((x: T) => string), val?: K):
    OperatorFunction<T[], (T & { [key in typeof val]?: ProfileWithAvatar })[]> {
    return (stream: Observable<T[]>) => {
      return stream
        .pipe(
          map(elements => {
            return this.extendByName(elements, name, val);
          })
        );
    };
  }

  /**
   * Like extendByExtension but operates on an observable
   *
   * @param name The name of the property that holds the extension
   * @param val The name of the new property that should hold the profile
   * @returns
   */
  withUserByExt<T, K extends string = 'profile'>(name: keyof T | ((x: T) => string), val?: K):
    OperatorFunction<T[], (T & { [key in typeof val]?: ProfileWithAvatar })[]> {
    return (stream: Observable<T[]>) => {
      return stream
        .pipe(
          map(elements => {
            return this.extendByExtension(elements, name, val);
          })
        );
    };
  }
}
