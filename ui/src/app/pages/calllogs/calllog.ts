import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject, model, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Timestamp } from '@bufbuild/protobuf';
import { Code, ConnectError } from '@connectrpc/connect';
import { BrnSelectModule } from '@spartan-ng/ui-select-brain';
import { BrnSeparatorComponent } from '@spartan-ng/ui-separator-brain';
import { HlmCardModule } from '@tierklinik-dobersberg/angular/card';
import { HlmCheckboxComponent } from '@tierklinik-dobersberg/angular/checkbox';
import { HlmLabelDirective } from '@tierklinik-dobersberg/angular/label';
import { DurationPipe } from '@tierklinik-dobersberg/angular/pipes';
import { HlmSelectModule } from '@tierklinik-dobersberg/angular/select';
import { HlmSeparatorModule } from '@tierklinik-dobersberg/angular/separator';
import { Customer } from '@tierklinik-dobersberg/apis/customer/v1';
import { CallDirection, CallEntry, CallRecordReceived, CallStatus, SearchCallLogsResponse } from '@tierklinik-dobersberg/apis/pbx3cx/v1';
import { startOfDay } from 'date-fns';
import { toast } from 'ngx-sonner';
import { injectCallService } from 'src/app/api/connect_clients';
import { CallLogTableComponent } from 'src/app/components/callog-table';
import { TkdDatePickerComponent } from 'src/app/components/date-picker';
import { TkdPaginationComponent } from 'src/app/components/pagination';
import { HeaderTitleService } from 'src/app/layout/header-title';
import { EventService } from 'src/app/services/event.service';

type CallTypeFilter = 'all' | 'inbound' | 'outbound' | 'missed';

@Component({
  templateUrl: './calllog.html',
  styleUrls: ['./calllog.scss'],
  standalone: true,
  changeDetection:ChangeDetectionStrategy.OnPush,
  imports: [
    TkdDatePickerComponent,
    FormsModule,
    CallLogTableComponent,
    DurationPipe,
    DecimalPipe,
    HlmCardModule,
    BrnSeparatorComponent,
    HlmSeparatorModule,
    BrnSelectModule,
    HlmCheckboxComponent,
    HlmLabelDirective,
    HlmSelectModule,
    TkdPaginationComponent
  ]
})
export class CallLogComponent implements OnInit {
  private readonly header = inject(HeaderTitleService);
  private readonly callService = injectCallService();

  /** The current type filter value */
  protected readonly typeFilter = model<CallTypeFilter>('inbound');

  /** The number of distinct callers */
  protected readonly distinctCallers = computed(() => {
    const logs = this.logs();
    const set = new Set<string>();
    
    logs.forEach(entry => set.add(entry.caller))
    
    return set.size;
  })

  /** The number of missed calls */
  protected readonly missedCalls = computed(() => {
    const logs = this.logs();

    return logs
      .filter(entry => !entry.callType)    
      .length;
  })

  /** The total call time of all call records */
  protected readonly totalCallTime = computed(() => {
    const logs = this.logs();
    
    return logs.reduce((sum, current) => {
      return sum + current.duration.seconds
    }, BigInt(0))
  })
  
  /** All loaded call log records */
  protected readonly logs = signal<CallEntry[]>([]);

  /** All customers records for the loaded call entries */
  protected readonly customers = signal<Customer[]>([]);

  /** Whether or not we are still loading */
  protected readonly loading = signal(true);

  /** Used to trigger a reload. */
  protected readonly tick = signal(0);

  /** Whether or not internal 3cx forwarded calls (extension to mobile) should be hidden */
  protected readonly hideForwardedCalls = model(true);

  /** The currently shown time-range */
  protected readonly dateRange = signal<[Date, Date | null]>((() => {
    const now = new Date();
    return [
      startOfDay(now),
      null,
    ]
  })())

  protected readonly _computedFilteredLogs = computed( () => {
    const logs = this.logs();
    const filter = this.typeFilter();

    if (filter === 'all') {
      return logs
    }

    return logs.filter(r => {
        const callType = r.callType?.toLocaleLowerCase() || 'inbound';
        let isOutbound = false;
        if (r.direction !== CallDirection.UNSPECIFIED) {
          isOutbound = r.direction == CallDirection.OUTBOUND
        } else {
          isOutbound = callType === 'notanswered' || callType === 'outbound';
        }

        let lost = false;
        if (r.status !== CallStatus.UNSPECIFIED) {
          lost = r.status == CallStatus.MISSED || r.status == CallStatus.NOTANSWERED
        } else {
          lost = callType === 'notanswered' || callType === 'missed';
        }

        if (r.queueExtension === r.acceptedAgent) {
          lost = true
        }

      if (filter === 'inbound') {
        return !isOutbound;
      }

      if (filter === 'outbound') {
        return isOutbound
      }

      return lost
    })
  })

  constructor() {
    let abrt: AbortController | null = null;

    effect(() => {
      this.dateRange()
      this.loading.set(true);
    }, { allowSignalWrites: true })

    effect(() => {
      this.tick();

      const range = this.dateRange();

      if (abrt) {
        abrt.abort();
      }

      abrt = new AbortController()

      abrt.signal.addEventListener('abort', () => {
        console.log("searching calllogs aborted")
      })

      this.callService
        .searchCallLogs({
          timeRange: {
            from: Timestamp.fromDate(range[0]),
            to: range[1] ? Timestamp.fromDate(range[1]) : undefined,
          }
        }, {signal: abrt.signal})
        .catch(err => {
          const cErr = ConnectError.from(err);

          if (cErr.code !== Code.NotFound) {
            toast.error('Anruf-Journal konnte nicht geladen werden', {
              description: cErr.message
            })
          }
          
          return new SearchCallLogsResponse()
        })
        .then(response => {
          abrt = null;

          this.logs.set(response.results);
          this.customers.set(response.customers);
          this.loading.set(false);
        })
      
    }, { allowSignalWrites: true })

    inject(EventService)
      .listen([new CallRecordReceived])
      .pipe(takeUntilDestroyed())
      .subscribe(event => {
        console.log("received call-record-received event, reloading call-logs")
        this.tick.set(new Date().getTime())
      })
  }

  ngOnInit(): void {
    this.header.set('Anruf Journal', 'Protokol der eingehenden und ausgehenden Telefonate.');
  }
}
