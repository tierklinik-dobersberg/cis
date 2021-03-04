import { Component, OnDestroy, OnInit } from '@angular/core';
import { BehaviorSubject, combineLatest, interval, Subscription } from 'rxjs';
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
  private selectedDate = new BehaviorSubject<Date>(new Date());

  date: Date;

  distinctCallers: Set<string> = new Set();
  totalCallTime = 0;
  logs: CallLogModel[] = [];
  loading = false;

  constructor(
    private header: HeaderTitleService,
    private calllogapi: CalllogAPI,
    private userService: UserService,
    public layout: LayoutService,
  ) { }

  onChange(date: Date): void {
    this.selectedDate.next(date);
  }

  ngOnInit(): void {
    this.header.set('Anruf Journal');
    this.date = new Date();
    this.subscriptions = new Subscription();

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
            const year = d.getFullYear();
            const month = d.getMonth() + 1;
            const day = d.getDate();

            return this.calllogapi.forDate(year, month, day);
          }),
        )
        .subscribe(logs => {
          this.logs = logs;

          this.distinctCallers = new Set();
          this.logs.forEach(log => {
            this.distinctCallers.add(log.caller);
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
