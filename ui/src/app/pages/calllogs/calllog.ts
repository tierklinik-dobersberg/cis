import { Component, OnDestroy, OnInit, TrackByFunction } from "@angular/core";
import { sum } from "ng-zorro-antd/core/util";
import { BehaviorSubject, combineLatest, forkJoin, interval, of, Subscription } from "rxjs";
import { catchError, mergeMap, startWith } from "rxjs/operators";
import { CallLog, CalllogAPI } from "src/app/api";
import { Customer, CustomerAPI } from "src/app/api/customer.api";

interface LocalCallLog extends CallLog {
  localDate: string;
  customer?: Customer;
}

@Component({
  templateUrl: './calllog.html',
  styleUrls: ['./calllog.scss'],
})
export class CallLogComponent implements OnInit, OnDestroy {
  private subscriptions = Subscription.EMPTY;
  private _selectedDate = new BehaviorSubject<Date>(new Date());

  date: Date;

  totalCallTime: number = 0;
  logs: LocalCallLog[] = [];

  trackLog: TrackByFunction<CallLog> = (i: number, l: LocalCallLog) => {
    if (!!l) {
      return l._id!;
    }

    return i;
  };

  constructor(
    private calllogapi: CalllogAPI,
    private customerapi: CustomerAPI,
  ) { }

  onChange(date: Date) {
    this._selectedDate.next(date);
  }

  ngOnInit() {
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
          mergeMap(logs => {
            logs = logs || [];
            let queryForNumbers = Array.from(
              logs.reduce((res: Set<string>, l: CallLog) => {
                res.add(l.caller);
                return res;
              }, new Set<string>())
            );

            // make sure we don't send a query if there aren't any
            // numbers we want to lookup as it would return all
            // customers stored in CIS.
            let numbersStream = of([]);
            if (queryForNumbers.length > 0) {
              numbersStream = this.customerapi.search({
                phone: queryForNumbers,
              }).pipe(catchError(err => {
                console.log(err);
                return of([]);
              }));
            }

            return forkJoin({
              logs: of(logs),
              numbers: numbersStream,
            })
          })
        )
        .subscribe(logs => {
          let lm = new Map<string, Customer>();
          logs.numbers?.forEach(cust => cust.phoneNumbers?.forEach(number => {
            number = number.replace(" ", "")
            if (number === "") {
              return
            }

            lm.set(number, cust)
          }))

          this.totalCallTime = sum(
            logs.logs.map(l => l.durationSeconds || 0)
          )

          this.logs = logs.logs.map(l => {
            const cust = lm.get(l.caller);
            return {
              ...l,
              localDate: new Date(l.date).toLocaleString(),
              customer: cust,
            };
          });
        })

    this.subscriptions.add(sub);
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }
}
