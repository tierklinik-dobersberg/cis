import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { SchemaInstance } from './config.api';

export interface PingRecord<T extends (Date|string) = Date> {
  pingID: string;
  createdAt: T;
  fail: boolean;
}

export interface PingDefinition extends SchemaInstance {
  ExpectedInterval: number | string;
  GracePeriod: number | string;
  LastPingReceived: string;
  Name: string;
  Public: boolean;
  State?: "passed" | "late" | "failed";
  Tags?: string[];
  Comment?: string;
}

@Injectable({providedIn: "root"})
export class HealthchecksAPI {
  constructor(private http: HttpClient) {}

  getRecords(id: string, opts: {from?: Date, to?: Date} = {}): Observable<PingRecord[]> {
    return this.http.get<{records: PingRecord<string>[]}>(`/api/hc/v1/ping/${id}/records`)
      .pipe(
        map(result => result.records.map(r => ({
          ...r,
          createdAt: new Date(r.createdAt),
        })))
      )
  }
}

