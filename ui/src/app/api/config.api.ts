import {
  HttpClient,
  HttpParams,
} from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { NzMessageRef, NzMessageService } from 'ng-zorro-antd/message';
import {
  BehaviorSubject,
  Observable,
  combineLatest
} from 'rxjs';
import { distinctUntilChanged, map, retry } from 'rxjs/operators';
import { TriggerAPI } from '.';
import { ProfileService } from '../services/profile.service';
import { ROLE_SERVICE, USER_SERVICE } from './connect_clients';

export interface ExternalLink {
  ParentMenu: string;
  Text: string;
  Icon: string;
  RequiresRole: string[];
  Link: string;
  BlankTarget: boolean;
}

export enum WellKnownAnnotations {
  Secret = 'system-conf/secret',
  OverviewFields = 'vet.dobersberg.cis:schema/overviewFields',
  OneOf = 'vet.dobersberg.cis:schema/oneOf',
  StringFormat = 'vet.dobersberg.cis:schema/stringFormat',
  Readonly = 'vet.dobersberg.cis:schema/readonly'
}

export interface PossibleValue<T = any> {
  display: string;
  value: T;
}
export interface OneOfValuesAnnotation {
  values: PossibleValue[];
  allowCustomValue: boolean;
}

export interface OneOfRefAnnotation {
  schemaType: string;
  valueField: string;
  displayField: string;
  allowCustomValue: boolean;
}

export interface StringFormatAnnotation {
  format: string;
}

export type OneOf = OneOfValuesAnnotation | OneOfRefAnnotation;

export interface Schema extends Annotated {
  name: string;
  displayName: string;
  description: string;
  svgData?: string;
  category: string;
  multi: boolean;
  options: OptionSpec[];
  tests?: ConfigTest[];
}

export interface ConfigTest {
  id: string;
  name: string;
  spec: OptionSpec[];
}

export interface SchemaInstance {
  [key: string]: any;
}

export interface OptionSpec extends Annotated {
  name: string;
  description: string;
  type: string;
  required: boolean;
  default: string;
}

export interface Annotated {
  annotation?: {
    [key: string]: any;
  };
}


export interface QuickRosterOverwrite {
  DisplayName: string;
  TargetNumber: string;
  RequiresRole: string[] | null;
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
  AllowAnyUserAsOverwrite: boolean;
  AllowPhoneNumberOverwrite: boolean;
}

export interface UIConfig {
  UI?: {
    HideUsersWithRole?: string[];
    UserPhoneExtensionProperties?: string[];
    CreateEventAlwaysAllowCalendar?: string[];
    OnCallRosterType?: string;
    OfftimeCommentScope?: string;
    ComputerAccountRole?: string;
  };
  ExternalLink?: ExternalLink[];
  QuickRosterOverwrite?: QuickRosterOverwrite[];
  KnownPhoneExtension?: KnownPhoneExtension[];
  TriggerAction?: TriggerAction[];
  Roster?: RosterUIConfig;
}

@Injectable({
  providedIn: 'root',
})
export class ConfigAPI {
  private onChange = new BehaviorSubject<UIConfig | null>(null);
  private reload$ = new BehaviorSubject<void>(undefined);

  get change(): Observable<UIConfig | null> {
    return this.onChange
      .pipe(
        distinctUntilChanged((prev, cur) => JSON.stringify(prev) === JSON.stringify(cur))
      )
  }

  get current(): UIConfig | null {
    return this.onChange.getValue();
  }

  reload() {
    this.reload$.next();
  }

  private roleService = inject(ROLE_SERVICE);
  private userService = inject(USER_SERVICE);

  constructor(
    private http: HttpClient,
    private nzMessageService: NzMessageService,
    private triggerapi: TriggerAPI,
    private profileService: ProfileService,
  ) {
    let loading: NzMessageRef | null = null;
    combineLatest([
      this.profileService.profile$
        .pipe(
          map(profile => profile?.user?.id),
          distinctUntilChanged(),
        ),
      this.reload$,

    ]).subscribe(() => {
      this.loaddUIConfig()
        .pipe(
          retry({delay: 10000}),
        )
        .subscribe(
          (cfg) => {
            if (!!loading) {
              this.nzMessageService.remove(loading.messageId);
              loading = null;
            }

            // finally, notify all other subscribes of UI config
            // changes.
            this.onChange.next(cfg);
          },
          (err) => {}
        );
    });
  }

  loaddUIConfig(): Observable<UIConfig> {
    return this.http.get<UIConfig>('/api/config/v1/flat', {
      params: new HttpParams()
        .append('keys', 'UI')
        .append('keys', 'ExternalLink')
        .append('keys', 'QuickRosterOverwrite')
        .append('keys', 'TriggerAction')
        .append('keys', 'KnownPhoneExtension')
        .append('keys', 'Roster')
    });
  }

  hasAnnotation(obj: Annotated, annotationKey: WellKnownAnnotations): boolean {
    return !!obj.annotation && annotationKey in obj.annotation;
  }

  getAnnotation<T = any>(
    obj: Annotated,
    key: WellKnownAnnotations
  ): T | undefined {
    if (!obj.annotation || obj.annotation[key] === undefined) {
      return undefined;
    }
    return obj.annotation[key];
  }

  oneOf(obj: Annotated): OneOf | null {
    const val = this.getAnnotation<OneOf>(obj, WellKnownAnnotations.OneOf);
    if (val === undefined) {
      return null;
    }
    return val;
  }

  customValueAllowed(obj: Annotated): boolean {
    const oneOf = this.oneOf(obj);
    if (oneOf === null) {
      return true;
    }
    return oneOf.allowCustomValue;
  }

  async resolvePossibleValues(obj: Annotated): Promise<PossibleValue[] | null> {
    const oneOf = this.oneOf(obj);
    if (oneOf === null) {
      return null;
    }

    if ('values' in oneOf) {
      return oneOf.values.map(val => {
        return {
          ...val,
          display: val.display || val.value,
        }
      });
    }

    let values: { [key: string]: any }[] = [];

    switch (oneOf.schemaType) {
      case 'identity:roles':
        values = (await this.roleService.listRoles({})).roles;
        break;
      case 'identity:users':
        values = (await this.userService.listUsers({})).users;
        break;
      case 'trigger':
        const triggers = await this.triggerapi.listInstances().toPromise()
        values = triggers.map(instance => {
          return {
            ...instance.config,
            _id: instance.id,
          }
        })
        break;
      case 'events':
        values = await this.triggerapi.listEventTypes().toPromise()
        break;
      default:
        const instances = await this.getSettings(oneOf.schemaType).toPromise();
        Object.keys(instances).forEach((key) => values.push({
          ...instances[key],
          _id: key,
        }));
    }

    var resultSet = new Map<string, PossibleValue>();
    (values || []).forEach((config) => {
      let value: string | string[] = config[oneOf.valueField];
      if (!Array.isArray(value)) {
        value = [value];
      }

      value.forEach(val => {
        let display: string = config[oneOf.displayField]

        if (!display || oneOf.displayField === oneOf.valueField || !oneOf.displayField) {
          display = val;
        }

        const pv = {
          display: display,
          value: val,
        }
        resultSet.set(`${pv.value}:${pv.display}`, pv);
      })

    });
    return Array.from(resultSet.values());
  }

  listSchemas(): Observable<Schema[]> {
    return this.http
      .get<{ schemas: Schema[] }>(`/api/config/v1/schema`)
      .pipe(map((res) => res.schemas || []));
  }

  getSettings(key: string): Observable<{ [key: string]: SchemaInstance }> {
    return this.http
      .get<{ configs: { [key: string]: SchemaInstance } }>(
        `/api/config/v1/schema/${key}`
      )
      .pipe(map((res) => res.configs));
  }

  createSetting(
    key: string,
    values: SchemaInstance
  ): Observable<{ id: string; warning?: string }> {
    return this.http.post<{ id: string; warning?: string }>(
      `/api/config/v1/schema/${key}`,
      {
        config: values,
      }
    );
  }

  patchSetting(
    key: string,
    id: string,
    values: Partial<SchemaInstance>
  ): Observable<{ warning?: string }> {
    return this.http.patch<{ warning?: string }>(
      `/api/config/v1/schema/${key}/${id}`,
      {
        config: values,
      }
    );
  }

  updateSetting(
    key: string,
    id: string,
    values: Partial<SchemaInstance>
  ): Observable<{ warning?: string }> {
    return this.http.put<{ warning?: string }>(
      `/api/config/v1/schema/${key}/${id}`,
      {
        config: values,
      }
    );
  }

  deleteSetting(key: string, id: string): Observable<{ warning?: string }> {
    return this.http.delete<{ warning?: string }>(
      `/api/config/v1/schema/${key}/${id}`
    );
  }

  testSetting(
    key: string,
    testID: string,
    config: SchemaInstance,
    testConfig: SchemaInstance
  ): Observable<{ error?: string } | null> {
    return this.http.post<{ error?: string } | null>(
      `/api/config/v1/test/${key}/${testID}`,
      {
        config: config,
        testConfig: testConfig,
      }
    );
  }
}
