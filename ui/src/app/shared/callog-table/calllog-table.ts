import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  TrackByFunction,
} from '@angular/core';
import { sum } from 'ng-zorro-antd/core/util';
import {
  BehaviorSubject,
  combineLatest,
  forkJoin,
  Observable,
  of,
  Subscription,
} from 'rxjs';
import { catchError, debounceTime, switchMap } from 'rxjs/operators';
import {
  CallLog,
  CallLogModel,
  ConfigAPI,
  ProfileWithAvatar,
} from 'src/app/api';
import { Customer, CustomerAPI } from 'src/app/api/customer.api';
import { LayoutService } from 'src/app/services';

interface LocalCallLog extends CallLog {
  localDate: string;
  localTime: string;
  customer?: Customer;
  isToday: boolean;
  outbound: boolean;
  isLostOrUnanswared: boolean;
  isSelf: boolean;
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
  totalCallTime = new EventEmitter<number>();

  @Input()
  set records(v: CallLog[]) {
    this.callLogs.next(v);
  }

  logs: LocalCallLog[] = [];

  private knownExtensions: Map<string, ProfileWithAvatar> = new Map();

  trackLog: TrackByFunction<LocalCallLog> = (i: number, l: LocalCallLog) => {
    if (!!l && l._id !== undefined) {
      return l._id;
    }

    return i;
  };

  constructor(
    private customerapi: CustomerAPI,
    private configapi: ConfigAPI,
    private changeDetector: ChangeDetectorRef,
    public layout: LayoutService
  ) {}

  ngOnInit(): void {
    this.subscriptions = new Subscription();

    const configSub = this.configapi.change.subscribe((config) => {
      this.knownExtensions = new Map();
      (config.KnownPhoneExtension || []).forEach((known) => {
        this.knownExtensions.set(known.ExtensionNumber, {
          fullname: known.DisplayName,
        } as ProfileWithAvatar);
      });

      this.subscribeToCalllogs();
    });
    this.subscriptions.add(configSub);
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  private subscribeToCalllogs(): void {
    const sub = this.callLogs
      .pipe(
        debounceTime(100),
        switchMap((logs) => {
          logs = logs || [];

          const customerSet = new Map<string, [string, string]>();
          const distinctNumbers = new Set<string>();

          // get a list of distinct phone number and customer source/ID pairs.
          logs.forEach((l) => {
            if (!!l.customerID && !!l.customerSource) {
              customerSet.set(`${l.customerSource}/${l.customerID}`, [
                l.customerSource,
                l.customerID,
              ]);
            }

            if (l.caller !== 'anonymous') {
              let number = normalizePhone(l.caller);

              // Workaround for https://github.com/angular/angular/issues/11058
              // here. thats pretty nasty angular ....
              if (number.startsWith('+')) {
                number = '00' + number.slice(1);
              }
              distinctNumbers.add(number);
            }
          });
          const queryForNumbers = Array.from(distinctNumbers.values());

          // make sure we don't send a query if there aren't any
          // numbers we want to lookup as it would return all
          // customers stored in CIS.
          let numbersStream = of([]);
          if (queryForNumbers.length > 0) {
            numbersStream = this.customerapi
              .search({
                phone: queryForNumbers,
                includeUsers: 'yes',
              })
              .pipe(
                catchError((err) => {
                  console.log(err);
                  return of([]);
                })
              );
          }

          let allCustomers: Observable<Customer[]> = of([]);
          if (customerSet.size > 0) {
            allCustomers = combineLatest(
              Array.from(customerSet.values()).map(([source, id]) => {
                return this.customerapi
                  .byId(source, id)
                  .pipe(catchError((err) => of(null)));
              })
            );
          }

          return forkJoin({
            logs: of(logs),
            numbers: numbersStream,
            customers: allCustomers,
          });
        })
      )
      .subscribe((logs) => {
        const lm = new Map<string, Customer>();

        logs.numbers?.forEach((cust) =>
          cust.phoneNumbers?.forEach((phoneNumber) => {
            phoneNumber = normalizePhone(phoneNumber);
            if (phoneNumber === '') {
              return;
            }

            lm.set(phoneNumber, cust);
          })
        );

        this.totalCallTime.next(
          sum(logs.logs.map((l) => l.durationSeconds || 0))
        );

        this.logs = logs.logs.map((l) => {
          let cust: Customer | undefined;
          if (!!l.customerSource) {
            cust = logs.customers.find(
              (c) =>
                !!c && c.source === l.customerSource && c.cid === l.customerID
            );
          }

          if (!cust) {
            const caller = normalizePhone(l.caller);
            cust = lm.get(caller);
          }

          // TODO(ppacher): this is very specific to 3CX
          // maybe this should be configurable?
          const callType = l.callType?.toLocaleLowerCase() || '';
          const isOutbound =
            callType === 'notanswered' || callType === 'outbound';

          let isSelf = false;
          if (
            !!l.agentProfile &&
            !!cust &&
            l.agentProfile.name === cust._id &&
            cust.source === '__identities'
          ) {
            isSelf = true;
          }

          const d = new Date(l.date);
          return {
            ...l,
            outbound: isOutbound,
            localDate: d.toLocaleDateString(),
            localTime: d.toLocaleTimeString(),
            isToday: d.toLocaleDateString() == new Date().toLocaleDateString(),
            customer: cust,
            agentProfile: l.agentProfile || this.knownExtensions.get(l.agent),
            transferToProfile:
              l.transferToProfile || this.knownExtensions.get(l.transferTarget),
            isLostOrUnanswared: callType === 'notanswered' || callType === '',
            isSelf: isSelf,
          };
        });
        this.changeDetector.detectChanges();
      });

    this.subscriptions.add(sub);
  }
}

function normalizePhone(phone: string): string {
  return phone.replaceAll(' ', '');
}
