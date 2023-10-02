import { HttpClient } from "@angular/common/http";
import { Inject, Injectable } from "@angular/core";
import { BehaviorSubject, Observable, map } from "rxjs";
import { TKD_CIS_ENDPOINT } from "../common/tokens";
import { PermissionRequest, Permissions, Profile, ProfileWithPermissions, Token, UIPermissions } from "./account.types";

const tokenThreshold = 30 * 1000;

@Injectable({ providedIn: 'root' })
export class TkdAccountService {
  private onLogin = new BehaviorSubject<ProfileWithPermissions | null>(null);
  private token: Token | null = null;

  constructor(
    @Inject(TKD_CIS_ENDPOINT) private api: string,
    private http: HttpClient,
  ) {

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
    // FIXME
    return true
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
      map((pwa) => {
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

        const p: UIPermissions = {};

        Object.keys(actions || {}).forEach((perm) => {
          p[perm] = true
        });

        return {
          ...pwa,
          permissions: p,
        };
      })
    )
  }

  avatarUrl(user: string): string {
    return `account.dobersberg.dev/avatar/${user}`;
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
