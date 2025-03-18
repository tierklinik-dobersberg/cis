import {
  HttpClient,
  HttpParams,
} from '@angular/common/http';
import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { ConnectError } from '@connectrpc/connect';
import { injectUserProfiles } from '@tierklinik-dobersberg/angular/behaviors';
import { injectRoleService } from '@tierklinik-dobersberg/angular/connect';
import { toast } from 'ngx-sonner';
import {
  Observable
} from 'rxjs';
import { map, retry } from 'rxjs/operators';
import { injectStoredProfile } from '../utils/inject-helpers';

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
    TaskCommentScope?: string;
    ImportantTasksBoard?: string;
    ImportantTasksFilter?: string;
  };
  ExternalLink?: ExternalLink[];
  TriggerAction?: TriggerAction[];
  Roster?: RosterUIConfig;
}

export function injectCurrentConfig() {
  const api = inject(ConfigAPI);

  return computed(() => api.config())
}

@Injectable({
  providedIn: 'root',
})
export class ConfigAPI {
  private readonly currentUser = injectStoredProfile();
  private readonly roleService = injectRoleService()
  private readonly profiles = injectUserProfiles();
  private readonly http = inject(HttpClient);
  private readonly _config = signal<UIConfig>({})

  public readonly config = this._config.asReadonly();

  constructor() {
    effect(() => {
      const currentUser = this.currentUser();

      this.reload();
    })
  }

  reload() {
    console.log("Loading current configuration")

    this.http.get<UIConfig>('/api/config/v1/flat', {
      params: new HttpParams()
        .append('keys', 'UI')
        .append('keys', 'ExternalLink')
        .append('keys', 'Roster')
    }).pipe(retry({delay: 2000, count: 5}))
      .subscribe({
        next: result => this._config.set(result),
        error: err => {
          console.error(err);
          
          toast.error('Internal Error: failed to fetch configuration', {
            description: ConnectError.from(err).message
          })
        }
      })
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
        values = this.profiles();
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
