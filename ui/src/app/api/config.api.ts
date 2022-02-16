import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { NzMessageRef, NzMessageService } from 'ng-zorro-antd/message';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, delay, map, retryWhen, tap } from 'rxjs/operators';
import { IdentityAPI } from './identity.api';

export interface ExternalLink {
  ParentMenu: string;
  Text: string;
  Icon: string;
  RequiresRole: string[];
  Link: string;
  BlankTarget: boolean;
}

export interface Schema {
  name: string;
  displayName: string;
  description: string;
  svgData?: string;
  category: string;
  multi: boolean;
  options: OptionSpec[];
}

export interface SchemaInstance {
  [key: string]: any;
}

export interface OptionSpec {
  name: string;
  description: string;
  type: string;
  required: boolean;
  default: string;
}

export interface UserProperty extends OptionSpec {
  visibility: string;
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

export interface TriggerAction {
  Name: string;
  PrimaryTrigger: string;
  TriggerGroup: string[];
  ActionText: string;
  PendingText: string;
}

export interface RosterUIConfig {
  EligibleRolesForOverwrite: string[];
  AllowAnyUserAsOverwrite: boolean;
  AllowPhoneNumberOverwrite: boolean;
}

export interface UIConfig {
  UI?: {
    HideUsersWithRole?: string[];
    UserPhoneExtensionProperties?: string[];
    CreateEventAlwaysAllowCalendar?: string[];
  }
  ExternalLink?: ExternalLink[];
  UserProperty: UserProperty[];
  QuickRosterOverwrite?: QuickRosterOverwrite[];
  KnownPhoneExtension?: KnownPhoneExtension[];
  TriggerAction?: TriggerAction[];
  Roster?: RosterUIConfig;
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
    return this.onChange.getValue();
  }

  constructor(
    private http: HttpClient,
    private nzMessageService: NzMessageService,
    private identity: IdentityAPI,
  ) {
    let loading: NzMessageRef | null = null;
    this.identity.profileChange.subscribe(() => {
      this.loaddUIConfig()
        .pipe(
          tap(undefined, err => {
            if (!!loading) {
              return;
            }

            loading = this.nzMessageService.loading("Trying to load configuration")
          }),
          retryWhen(d => {
            return d.pipe(delay(2000));
          })
        )
        .subscribe(cfg => {
          if (!!loading) {
            this.nzMessageService.remove(loading.messageId);
            loading = null;
          }
          // we need to update the IdentityAPI ourself
          // as importing ConfigAPI there would cause a circular
          // dependency.
          this.identity.applyUIConfig(cfg);

          // finally, notify all other subscribes of UI config
          // changes.
          this.onChange.next(cfg);
          console.log(cfg);
        });
    });
  }

  loaddUIConfig(): Observable<UIConfig> {
    return this.http.get<UIConfig>('/api/config/v1/flat', {
      params: new HttpParams()
        .append("keys", "UI")
        .append("keys", "ExternalLink")
        .append("keys", "QuickRosterOverwrite")
        .append("keys", "TriggerAction")
        .append("keys", "KnownPhoneExtension")
        .append("keys", "Roster")
        .append("keys", "UserProperty")
    });
  }

  listSchemas(): Observable<Schema[]> {
    return this.http.get<{schemas: Schema[]}>(`/api/config/v1/schema`)
      .pipe(map(res => res.schemas || []))
  }

  getSettings(key: string): Observable<{[key: string]: SchemaInstance}> {
    return this.http.get<{configs: {[key: string]: SchemaInstance}}>(`/api/config/v1/schema/${key}`)
      .pipe(map(res => res.configs));
  }

  createSetting(key: string, values: SchemaInstance): Observable<{id: string, warning?: string}> {
    return this.http.post<{id: string, warning?: string}>(`/api/config/v1/schema/${key}`, {
      config: values
    })
  }

  patchSetting(key: string, id: string, values: Partial<SchemaInstance>): Observable<{warning?: string}> {
    return this.http.patch<{warning?: string}>(`/api/config/v1/schema/${key}/${id}`, {
      config: values,
  })
  }

  updateSetting(key: string, id: string, values: Partial<SchemaInstance>): Observable<{warning?: string}> {
    return this.http.put<{warning?: string}>(`/api/config/v1/schema/${key}/${id}`, {
      config: values
    })
  }

  deleteSetting(key: string, id: string): Observable<{warning?: string}> {
    return this.http.delete<{warning?: string}>(`/api/config/v1/schema/${key}/${id}`)
  }
}
