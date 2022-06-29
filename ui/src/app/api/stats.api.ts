import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { ChartData } from 'chart.js';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ColorService } from '../shared/charts/color.service';
import { Group } from './customer.api';

@Injectable({providedIn: 'root'})
export class StatsAPI {
  constructor(
    private http: HttpClient,
    private colorService: ColorService,
  ) {}

  groupByOverTime(collection: string, timeKey: string, groupKey: string, from: Date, to: Date, timeRange: string, count = ''): Observable<ChartData<'line'>> {
    return this.http.get<any>(`/api/stats/v1/${collection}/group-by-time/${timeKey}/${groupKey}`, {
      params: new HttpParams()
        .set("from", from.toISOString())
        .set("to", to.toISOString())
        .set('count', count)
        .set('time-range', timeRange)
    })
      .pipe(map(result => {
        result = result || [];
        this.colorService.colorizeDatasets(result);
        return {
          datasets: result,
        };
      }))
  }

  groupBy(collection: string, key: string, count = '', translateLables: {[key: string]: string} = null): Observable<ChartData<'pie' | 'bar' | 'line'>> {
    return this.http.get<Group[]>(`/api/stats/v1/${collection}/group-by/${key}`, {
      params: new HttpParams()
        .set('count', count)
    })
      .pipe(
        map(grps => {
          grps = grps || [];
          return {
            labels: grps.map(grp => this.relabel(grp.label || grp.id, translateLables)),
            datasets: [
              {
                data: grps.map(grp => grp.count),
                backgroundColor: this.colorService.colors,
              }
            ]
          }
        })
      )
  }

  count(collection: string, counter: string): Observable<number> {
    return this.http.get<number>(`/api/stats/v1/${collection}/count/${counter}`)
  }

  private relabel(label: string, translation: {[key: string]: string} = null) {
    if (translation === null) {
      translation = {};
    }
    const translated = translation[label];
    if (translated !== undefined) {
      return translated;
    }
    return label;
  }
}
