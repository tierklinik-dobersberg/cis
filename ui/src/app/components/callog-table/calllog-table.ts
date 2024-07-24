import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ConnectError } from '@connectrpc/connect';
import { injectUserProfiles } from '@tierklinik-dobersberg/angular/behaviors';
import { LayoutService } from '@tierklinik-dobersberg/angular/layout';
import {
  DisplayNamePipe,
  DurationPipe,
  ToUserPipe,
} from '@tierklinik-dobersberg/angular/pipes';
import { CallEntry } from '@tierklinik-dobersberg/apis/gen/es/tkd/pbx3cx/v1/calllog_pb';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { toast } from 'ngx-sonner';
import { forkJoin, of } from 'rxjs';
import { Customer, CustomerAPI, CustomerRef } from 'src/app/api/customer.api';

interface LocalCallLog {
  entry: CallEntry;

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
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NzTableModule,
    RouterLink,
    NzToolTipModule,
    ToUserPipe,
    DisplayNamePipe,
    DurationPipe,
  ],
})
export class CallLogTableComponent {
  public readonly records = input.required<CallEntry[]>();

  protected readonly customers = signal<Customer[]>([]);
  protected readonly logs = computed<LocalCallLog[]>(() => {
    const records = this.records();
    const customers = this.customers();

    const byId = new Map<string, Customer>();
    const byNumber = new Map<string, Customer>();

    customers.forEach(c => {
      byId.set(`${c.source}/${c.cid}`, c);
      c.distinctPhoneNumbers?.forEach(number => {
        byNumber.set(normalizePhone(number), c);
      });
    });

    return records.map(l => {
      // TODO(ppacher): this is very specific to 3CX
      // maybe this should be configurable?
      const callType = l.callType?.toLocaleLowerCase() || '';
      const isOutbound = callType === 'notanswered' || callType === 'outbound';

      let cust: Customer | null = null;

      if (l.customerSource && l.customerId) {
        cust = byId.get(`${l.customerSource}/${l.customerId}`);
      }

      if (!cust && l.caller !== 'anonymous') {
        cust = byNumber.get(normalizePhone(l.caller));
      }

      let isSelf = false;
      if (
        !!l.agentUserId &&
        !!cust &&
        l.agentUserId === cust._id &&
        cust.source === '__identities'
      ) {
        isSelf = true;
      }

      const d = l.receivedAt.toDate();
      return {
        entry: l,
        outbound: isOutbound,
        localDate: d.toLocaleDateString(),
        localTime: d.toLocaleTimeString(),
        isToday: d.toLocaleDateString() == new Date().toLocaleDateString(),
        customer: cust,
        isLostOrUnanswared: callType === 'notanswered' || callType === '',
        isSelf: isSelf,
      };
    });
  });

  protected readonly profiles = injectUserProfiles();
  protected readonly layout = inject(LayoutService);
  private readonly customerapi = inject(CustomerAPI);

  constructor() {
    effect(() => {
      const logs = this.records();

      const distinctNumbers = new Set<string>();
      const set = new Map<string, CustomerRef>();
      logs.forEach(log => {
        if (log.customerId && log.customerSource) {
          set.set(`${log.customerSource}/${log.customerId}`, {
            cid: log.customerId,
            source: log.customerSource,
          });
        } else if (log.caller !== 'anonymous') {
          let number = normalizePhone(log.caller);

          // Workaround for https://github.com/angular/angular/issues/11058
          // here. thats pretty nasty angular ....
          if (number.startsWith('+')) {
            number = '00' + number.slice(1);
          }

          distinctNumbers.add(number);
        }
      });

      const query = {
        cid: {
          $in: [],
        },
      };

      for (let ref of set.values()) {
        query.cid.$in.push(ref.cid);
      }

      let numberStream = of([] as Customer[]);
      if (distinctNumbers.size > 0) {
        numberStream = this.customerapi.search({
          phone: Array.from(distinctNumbers.values()),
          includeUsers: 'yes',
        });
      }

      forkJoin({
        byId: this.customerapi.extendedSearch(query),
        byNumber: numberStream,
      }).subscribe({
        next: response => {
          const distinct = new Map<string, Customer>();
          response.byId.forEach(c => distinct.set(`${c.source}/${c.cid}`, c));
          response.byNumber.forEach(c =>
            distinct.set(`${c.source}/${c.cid}`, c)
          );

          this.customers.set(Array.from(distinct.values()));
        },
        error: err => {
          console.error(err);
          toast.error('Kunden konnten nicht geladen werden', {
            description: ConnectError.from(err).message,
          });
        },
      });
    });
  }
}

function normalizePhone(phone: string): string {
  return phone.replaceAll(' ', '');
}
