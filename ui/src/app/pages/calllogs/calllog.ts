import { Component, OnDestroy, OnInit } from "@angular/core";
import { BehaviorSubject, combineLatest, interval, Subscription } from "rxjs";
import { mergeMap, startWith } from "rxjs/operators";
import { CallLogModel, CalllogAPI, UserService } from "src/app/api";
import { LayoutService } from 'src/app/services';
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
  logs: CallLogModel[] = [];

  constructor(
    private header: HeaderTitleService,
    private calllogapi: CalllogAPI,
    private userService: UserService,
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
        this.userService.updated,
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
