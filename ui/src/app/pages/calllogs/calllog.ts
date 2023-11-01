import { Timestamp } from '@bufbuild/protobuf';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CallEntry } from '@tkd/apis/gen/es/tkd/pbx3cx/v1/calllog_pb';
import { BehaviorSubject, Subscription, combineLatest, interval } from 'rxjs';
import { mergeMap, startWith } from 'rxjs/operators';
import { UserService } from 'src/app/api';
import { CALL_SERVICE } from 'src/app/api/connect_clients';
import { HeaderTitleService } from 'src/app/shared/header-title';
import { toDateString } from 'src/app/utils';

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
  logs: CallEntry[] = [];
  loading = false;

  private callService = inject(CALL_SERVICE);

  constructor(
    private header: HeaderTitleService,
    private userService: UserService,
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
              return this.callService.searchCallLogs({
                timeRange: {
                  from: Timestamp.fromDate(d[0]),
                  to: Timestamp.fromDate(d[1]),
                }
              })
            }
            return this.callService.searchCallLogs({date: toDateString(d[0])});
          }),
        )
        .subscribe(logs => {
          this.missedCalls = 0;
          this.logs = logs.results || [];
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
