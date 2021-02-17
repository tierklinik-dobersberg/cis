import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { BehaviorSubject, Observable, of } from "rxjs";
import { catchError } from "rxjs/operators";
import { IdentityAPI } from "./identity.api";

export interface ExternalLink {
  ParentMenu: string;
  Text: string;
  Icon: string;
  RequiresRole: string[];
  Link: string;
  BlankTarget: boolean;
}

export interface UserProperty {
  name: string;
  description: string;
  type: string;
  required: boolean;
  visibility: string;
  default: string;
  displayName?: string;
}

export interface QuickRosterOverwrite {
  DisplayName: string;
  TargetNumber: string;
}

export interface KnownPhoneExtension {
  DisplayName: string;
  ExtensionNumber: string;
}

export interface UIConfig {
  HideUsersWithRole?: string[];
  ExternalLinks?: ExternalLink[];
  UserProperties: UserProperty[];
  QuickRosterOverwrites?: QuickRosterOverwrite[];
  KnownPhoneExtensions?: KnownPhoneExtension[];
  UserPhoneExtensionProperties?: string[];
}

@Injectable({
  providedIn: 'root'
})
export class ConfigAPI {
  private onChange = new BehaviorSubject<UIConfig | null>(null);

  get change(): Observable<UIConfig | null> {
    return this.onChange;
  }

  get current(): UIConfig | null {
    return this.onChange.getValue()
  }

  constructor(
    private http: HttpClient,
    private identity: IdentityAPI,
  ) {
    this.identity.profileChange.subscribe(() => {
      this.loaddUIConfig()
        .pipe(catchError(err => {
          return of(null);
        }))
        .subscribe(cfg => {
          // we need to update the IdentityAPI ourself
          // as importing ConfigAPI there would cause a circular
          // dependency.
          this.identity.applyUIConfig(cfg);

          // finally, notify all other subscribes of UI config
          // changes.
          this.onChange.next(cfg);
          console.log(cfg);
        })
    });
  }

  loaddUIConfig(): Observable<UIConfig> {
    return this.http.get<UIConfig>('/api/config/v1/ui');
  }
}
