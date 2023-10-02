import { Component, OnDestroy, OnInit } from '@angular/core';
import { BehaviorSubject, Subscription, combineLatest, interval } from 'rxjs';
import { mergeMap, startWith } from 'rxjs/operators';
import { CallLogModel, CalllogAPI, UserService } from 'src/app/api';
import { LayoutService } from 'src/app/services';
import { HeaderTitleService } from 'src/app/shared/header-title';

@Component({
  templateUrl: './calllog.html',
  styleUrls: ['./calllog.scss'],
})
export class CallLogComponent implements OnInit, OnDestroy {
  private subscriptions = Subscription.EMPTY;
  private selectedDate = new BehaviorSubject<Date[]>([]);

  dateRange: Date[] = [];

  distinctCallers: Set<string> = new Set();
  missedCalls = 0;
  totalCallTime = 0;
  logs: CallLogModel[] = [];
  loading = false;

  constructor(
    private header: HeaderTitleService,
    private calllogapi: CalllogAPI,
    private userService: UserService,
    public layout: LayoutService,
  ) { }

  onChange(date: Date[]): void {
    this.selectedDate.next(date);
  }

  ngOnInit(): void {
    this.header.set('Anruf Journal', 'Protokol der eingehenden und ausgehenden Telefonate.');
    this.subscriptions = new Subscription();

    const now = new Date();
    this.dateRange = [
      new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0),
      new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
    ]
    this.selectedDate.next(this.dateRange);

    const sub =
      combineLatest([
        interval(60000).pipe(startWith(-1)),
        this.selectedDate,
        this.userService.updated,
      ])
        .pipe(
          mergeMap(() => this.selectedDate),
          mergeMap(d => {
            this.loading = true;

            if (!!d[0] && !!d[1]) {
              return this.calllogapi.search({
                from: d[0],
                to: d[1],
              })
            }
            return this.calllogapi.search({at: d[0]});
          }),
        )
        .subscribe(logs => {
          this.missedCalls = 0;
          this.logs = logs.items || [];
          this.distinctCallers = new Set();
          this.logs.forEach(log => {
            this.distinctCallers.add(log.caller);
            if (!log.callType) {
              this.missedCalls++;
            }
          });

          setTimeout(() => {
            this.loading = false;
          }, 300);
        });

    this.subscriptions.add(sub);
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }
}
