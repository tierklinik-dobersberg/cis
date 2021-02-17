import { ChangeDetectorRef, Component, EventEmitter, Input, OnDestroy, OnInit, Output, TrackByFunction } from '@angular/core';
import { sum } from 'ng-zorro-antd/core/util';
import { BehaviorSubject, combineLatest, forkJoin, Observable, of, Subject, Subscription } from 'rxjs';
import { catchError, debounceTime, mergeMap, switchMap } from 'rxjs/operators';
import { CallLog, CalllogAPI, CallLogModel, ConfigAPI, ProfileWithAvatar } from 'src/app/api';
import { Customer, CustomerAPI } from 'src/app/api/customer.api';
import { LayoutService } from 'src/app/services';

interface LocalCallLog extends CallLog {
  localDate: string;
  localTime: string;
  customer?: Customer;
}

@Component({
  selector: 'app-calllog-table',
  templateUrl: './calllog-table.html',
  styleUrls: ['./calllog-table.scss'],
})
export class CallLogTableComponent implements OnInit, OnDestroy {
  private subscriptions = Subscription.EMPTY;
  private callLogs = new BehaviorSubject<CallLog[]>([]);

  date: Date;

  @Output()
  totalCallTime = new EventEmitter<number>()

  @Input()
  set records(v: CallLog[]) {
    console.log(`Input`, v)
    this.callLogs.next(v);
  }

  logs: LocalCallLog[] = [];

  private knownExtensions: Map<string, ProfileWithAvatar> = new Map();

  trackLog: TrackByFunction<CallLogModel> = (i: number, l: CallLogModel) => {
    if (!!l) {
      return l._id!;
    }

    return i;
  };

  constructor(
    private customerapi: CustomerAPI,
    private configapi: ConfigAPI,
    private changeDetector: ChangeDetectorRef,
    public layout: LayoutService,
  ) { }

  ngOnInit() {
    this.subscriptions = new Subscription();

    const configSub = this.configapi.change.subscribe(config => {
      this.knownExtensions = new Map();
      (config.KnownPhoneExtensions || []).forEach(known => {
        this.knownExtensions.set(known.ExtensionNumber, { fullname: known.DisplayName } as ProfileWithAvatar)
      })

      this.subscribeToCalllogs();
    })
    this.subscriptions.add(configSub);
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  private subscribeToCalllogs() {
    const sub =
      this.callLogs
        .pipe(
          debounceTime(100),
          switchMap(logs => {
            console.log(`Loading ...`, logs)
            logs = logs || [];

            let customerSet = new Map<string, [string, string]>();
            let distinctNumbers = new Set<string>();

            // get a list of distinct phone number and customer source/ID pairs.
            logs.forEach(l => {
              if (!!l.customerID && !!l.customerSource) {
                customerSet.set(`${l.customerSource}/${l.customerID}`, [
                  l.customerSource,
                  l.customerID
                ]);
              }

              if (l.caller !== 'anonymous') {
                distinctNumbers.add(l.caller.replace(" ", ""));
              }
            })
            let queryForNumbers = Array.from(distinctNumbers.values());

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

            let allCustomers: Observable<Customer[]> = of([]);
            if (customerSet.size > 0) {
              allCustomers = combineLatest(
                Array.from(customerSet.values()).map(([source, id]) => {
                  return this.customerapi.byId(source, id)
                    .pipe(catchError(err => of(null)));
                })
              )
            }

            return forkJoin({
              logs: of(logs),
              numbers: numbersStream,
              customers: allCustomers,
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

          this.totalCallTime.next(sum(
            logs.logs.map(l => l.durationSeconds || 0)
          ))

          this.logs = logs.logs.map(l => {
            let cust: Customer | undefined;
            if (!!l.customerSource) {
              cust = logs.customers
                .find(c => !!c && c.source === l.customerSource && c.cid == +l.customerID);
            }

            if (!cust) {
              cust = lm.get(l.caller);
            }

            let d = new Date(l.date);
            return {
              ...l,
              localDate: d.toLocaleDateString(),
              localTime: d.toLocaleTimeString(),
              customer: cust,
              agentProfile: l.agentProfile || this.knownExtensions.get(l.agent),
              transferToProfile: l.transferToProfile || this.knownExtensions.get(l.transferTarget)
            };
          });
          this.changeDetector.detectChanges();
        })

    this.subscriptions.add(sub);
  }
}
