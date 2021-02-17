import { Component, OnDestroy, OnInit, TrackByFunction } from "@angular/core";
import { sum } from "ng-zorro-antd/core/util";
import { BehaviorSubject, combineLatest, forkJoin, interval, Observable, of, Subject, Subscription } from "rxjs";
import { catchError, mergeMap, startWith } from "rxjs/operators";
import { CallLog, CalllogAPI, ConfigAPI, IdentityAPI, ProfileWithAvatar } from "src/app/api";
import { Customer, CustomerAPI } from "src/app/api/customer.api";
import { LayoutService } from "src/app/layout.service";
import { HeaderTitleService } from "src/app/shared/header-title";

@Component({
  templateUrl: './calllog.html',
  styleUrls: ['./calllog.scss'],
})
export class CallLogComponent implements OnInit, OnDestroy {
  private subscriptions = Subscription.EMPTY;
  private _selectedDate = new BehaviorSubject<Date>(new Date());

  date: Date;

  totalCallTime: number = 0;
  logs: CallLog[] = [];

  constructor(
    private header: HeaderTitleService,
    private calllogapi: CalllogAPI,
    public layout: LayoutService,
  ) { }

  onChange(date: Date) {
    this._selectedDate.next(date);
  }

  ngOnInit() {
    this.header.set('Anruf Journal');
    this.date = new Date();
    this.subscriptions = new Subscription();

    const sub =
      combineLatest([
        interval(60000).pipe(startWith(-1)),
        this._selectedDate,
      ])
        .pipe(
          mergeMap(() => this._selectedDate),
          mergeMap(d => {
            const year = d.getFullYear();
            const month = d.getMonth() + 1
            const day = d.getDate();

            return this.calllogapi.forDate(year, month, day);
          }),
        )
        .subscribe(logs => {
          this.logs = logs;
        })

    this.subscriptions.add(sub);
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }
}
