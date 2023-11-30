import { Inject, Injectable } from '@angular/core';
import { Profile } from '@tkd/apis';
import {
  BehaviorSubject,
  Observable,
  OperatorFunction,
  combineLatest,
  from,
} from 'rxjs';
import { delay, filter, map, mergeMap, retryWhen } from 'rxjs/operators';
import { ConfigAPI } from './config.api';
import { USER_SERVICE, UserServiceClient } from './connect_clients';

/**
 * UserService keeps a list of all users to be used
 * across the web-application.
 */
@Injectable({
  providedIn: 'root',
})
export class UserService {
  /** Used to notify subscribers about new user data. */
  private updated$ = new BehaviorSubject<boolean>(false);

  /** Users indexed by name */
  private usersByName: Map<string, Profile> = new Map();

  /** Users indexed by id */
  private usersById: Map<string, Profile> = new Map();

  /** Users indexed by phone-extension */
  private usersByExtension: Map<string, Profile> = new Map();

  /** Users indexed by calendar ID */
  private usersByCalendarID: Map<string, Profile> = new Map();

  /** Emits whenever users have been reloaded */
  get updated(): Observable<void> {
    return this.updated$.asObservable().pipe(
      filter((loaded) => !!loaded),
      map(() => {})
    );
  }

  /** Emits all users */
  get users(): Observable<Profile[]> {
    return this.updated.pipe(map(() => Array.from(this.usersByName.values())));
  }

  /** Returns all users */
  get snapshot(): Profile[] {
    return Array.from(this.usersByName.values());
  }

  private reload$ = new BehaviorSubject<void>(undefined);

  /** Force a reload of all available users. */
  reloadUsers() {
    this.reload$.next();
  }

  constructor(
    @Inject(USER_SERVICE) private userService: UserServiceClient,
    private configapi: ConfigAPI) {

    combineLatest([this.configapi.change, this.reload$])
      .pipe(
        filter(([cfg]) => !!cfg),
        mergeMap(() => from(this.userService.listUsers({}))),
        retryWhen((err) => err.pipe(delay(2000)))
      )
      .subscribe((response) => this.updateUsers(response.users));
  }

  /**
   * Returns the user by username.
   *
   * @param username The username to search for
   */
  byName(username: string): Profile | null {
    return this.usersByName.get(username) || null;
  }

  /**
   * Returns the user by id.
   *
   * @param username The username to search for
   */
  byId(userId: string): Profile | null {
    return this.usersById.get(userId) || null;
  }

  /**
   * Returns the user by "phone" extension.
   *
   * @param ext The user extension to search for.
   */
  byExtension(ext: string): Profile | null {
    return this.usersByExtension.get(ext) || null;
  }

  /**
   * Returns the user by "calendar" id.
   *
   * @param id The ID of the calendar
   * @returns
   */
  byCalendarID(id: string): Profile | null {
    return this.usersByCalendarID.get(id) || null;
  }

  /**
   * Returns a list of user profiles that have roleName.
   *
   * @param roleName The name of the role
   */
  byRole(roleName: string): Profile[] {
    return Array.from(this.usersByName.values()).filter((user) =>
      user.roles?.find(role => role.id === roleName || role.name == roleName) // FIXME
    );
  }

  /**
   * Updates the internal maps to search for users.
   *
   * @param profiles The list of users loaded from CIS.
   */
  private updateUsers(profiles: Profile[]): void {
    this.usersByExtension = new Map();
    this.usersByName = new Map();
    this.usersById = new Map();
    this.usersByCalendarID = new Map();

    const cfg = this.configapi.current;
    const phoneExtension = cfg?.UI?.UserPhoneExtensionProperties || [];
    profiles.forEach((profile) => {

      this.usersByName.set(profile.user.username, profile);
      this.usersById.set(profile.user.id, profile);

      if (!!profile.user.extra?.fields?.calendarID) {
        this.usersByCalendarID.set(profile.user.extra.fields.calendarID.kind.value as string, profile);
      }

      phoneExtension.forEach((ext) => {
        const prop = profile.user?.extra?.fields[ext];

        if (!prop) {
          return;
        }

        if (prop.kind.case === 'stringValue' || prop.kind.case === 'numberValue') {
          const value = `${prop.kind.value}`;
          if (!!value) {
            this.usersByExtension.set(value, profile);
          }
        }

      });
    });

    this.updated$.next(true);
  }

  extendList<T, K extends string>(
    list: T[],
    getUser: (e: T) => Profile,
    val: K
  ): (T & { [key in typeof val]?: Profile})[] {
    return list.map((elem) => this.extendRecord(elem, getUser, val));
  }

  extendRecord<T, K extends string>(
    elem: T,
    getUser: (e: T) => Profile,
    val: K
  ): T & { [key in typeof val]?: Profile} {
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
  extendByName<T, K extends string = 'profile'>(
    list: T[],
    userNameProp: keyof T | ((x: T) => string),
    val?: K
  ): (T & { [key in typeof val]?: Profile})[] {
    let getUsername: (x: T) => Profile;

    if (typeof userNameProp === 'string') {
      getUsername = (x) => this.byName(x[userNameProp as string]);
    } else {
      getUsername = (x) => this.byName((userNameProp as any)(x));
    }

    return this.extendList(list, getUsername, val || 'profile');
  }

  extendById<T, K extends string = 'profile'>(
    list: T[],
    userIdProp: keyof T | ((x: T) => string),
    val?: K
  ): (T & { [key in typeof val]?: Profile})[] {
    let getUser: (x: T) => Profile;

    if (typeof userIdProp === 'string') {
      getUser = (x) => this.byId(x[userIdProp as string]);
    } else {
      getUser = (x) => this.byId((userIdProp as any)(x));
    }

    return this.extendList(list, getUser, val || 'profile');
  }

  /**
   * Extends each element in list with the user profile that is
   * referenced by the elements [userExtProp] property.
   *
   * @param list The list of records to extend.
   * @param userExtProp The name of the element property that holds
   *                    the extension or a function to retrieve it
   */
  extendByExtension<T, K extends string = 'profile'>(
    list: T[],
    userExtProp: keyof T | ((x: T) => string),
    val?: K
  ): (T & { [key in typeof val]?: Profile})[] {
    let getExtension: (x: T) => Profile;

    if (typeof userExtProp === 'string') {
      getExtension = (x) => this.byExtension(x[userExtProp as string]);
    } else {
      getExtension = (x) => this.byExtension((userExtProp as any)(x));
    }

    return this.extendList(list, getExtension, val || 'profile');
  }

  /**
   * Like extendById but operates on an observable
   *
   * @param id The name of the property that holds the username
   * @param val The name of the new property that should hold the profile
   * @returns
   */
  withUserById<T, K extends string = 'profile'>(
    id: keyof T | ((x: T) => string),
    val?: K
  ): OperatorFunction<
    T[],
    (T & { [key in typeof val]?: Profile})[]
  > {
    return (stream: Observable<T[]>) => {
      return stream.pipe(
        map((elements) => {
          return this.extendById(elements, id, val);
        })
      );
    };
  }

  /**
   * Like extendByName but operates on an observable
   *
   * @param name The name of the property that holds the username
   * @param val The name of the new property that should hold the profile
   * @returns
   */
  withUserByName<T, K extends string = 'profile'>(
    name: keyof T | ((x: T) => string),
    val?: K
  ): OperatorFunction<
    T[],
    (T & { [key in typeof val]?: Profile})[]
  > {
    return (stream: Observable<T[]>) => {
      return stream.pipe(
        map((elements) => {
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
  withUserByExt<T, K extends string = 'profile'>(
    name: keyof T | ((x: T) => string),
    val?: K
  ): OperatorFunction<
    T[],
    (T & { [key in typeof val]?: Profile})[]
  > {
    return (stream: Observable<T[]>) => {
      return stream.pipe(
        map((elements) => {
          return this.extendByExtension(elements, name, val);
        })
      );
    };
  }
}
