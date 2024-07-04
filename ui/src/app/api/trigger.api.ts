import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { OptionSpec } from './config.api';
;

export interface ActionDef {
  id: string;
  type: string;
  options: {[key: string]: any};
}

export interface TriggerConfig {
  Name: string;
  Description?: string;
  EventFilter?: string[];
  BUfferUntil?: string[];
  DebounceUntil?: string[];
  Group?: string[];
}

export interface TriggerInstance {
    id: string,
    config: TriggerConfig;
    actions: ActionDef[] | null;
    pending?: boolean;
}

interface TriggerListResponse {
    instances: TriggerInstance[];
}

export interface ActionType {
  name: string;
  description: string;
  spec: OptionSpec[] | null;
}

interface ListTriggerActionTypesResponse {
  actions: ActionType[];
}

interface MatchSpecResponse {
  spec: OptionSpec[]
}

export interface EventType {
  Name: string;
  Description: string;
}

export interface ListEventTypesResponse {
  eventTypes: EventType[] | null;
}

@Injectable({ providedIn: 'root' })
export class TriggerAPI {
    constructor(private http: HttpClient) { }

    putTrigger(def: TriggerInstance): Observable<string> {
      if (def.id !== '') {
        return this.http.put<void>(`/api/triggers/v1/instance/${def.id}`, def)
          .pipe(map(res => def.id))
      }

      return this.http.post<{id: string}>(`/api/triggers/v1/instance`, def)
        .pipe(map(res => res.id));
    }

    deleteTrigger(id: string): Observable<void> {
      return this.http.delete<void>(`/api/triggers/v1/instance/${id}`)
    }

    /** Returns a trigger by type */
    getTrigger(id: string): Observable<TriggerInstance> {
      return this.http.get<TriggerInstance>(`/api/triggers/v1/instance/${id}`);
    }


    /** Returns all option specs for the trigger/event matching */
    matchSpec(): Observable<OptionSpec[]> {
      return this.http.get<MatchSpecResponse>(`/api/triggers/v1/match-spec`)
        .pipe(map(res => res.spec))
    }

    /** Returns a list of all available trigger action types */
    listActionTypes(): Observable<ActionType[]> {
      return this.http.get<ListTriggerActionTypesResponse>(`/api/triggers/v1/action-type`)
        .pipe(map(res => res.actions));
    }

    /** Returns a list of all available event types */
    listEventTypes(): Observable<EventType[]> {
      return this.http.get<ListEventTypesResponse>(`/api/triggers/v1/event-type`)
        .pipe(map(res => res.eventTypes));
    }

    /** Returns all available trigger instances */
    listInstances(): Observable<TriggerInstance[]> {
        return this.http.get<TriggerListResponse>(`/api/triggers/v1/instance`)
            .pipe(map(res => res.instances || []))
    }

    /** Executes the trigger */
    executeInstance(trigger: string): Observable<void> {
        return this.http.post<void>(`/api/triggers/v1/instance/${trigger}`, null)
    }

    /** Executes the trigger group */
    executeGroup(grpName: string): Observable<void> {
        return this.http.post<void>(`/api/triggers/v1/group/${grpName}`, null)
    }
}
