import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Timestamp } from '@bufbuild/protobuf';
import { Code, ConnectError } from '@connectrpc/connect';
import { DurationPipe } from '@tierklinik-dobersberg/angular/pipes';
import { CallEntry, SearchCallLogsResponse } from '@tierklinik-dobersberg/apis/gen/es/tkd/pbx3cx/v1/calllog_pb';
import { endOfDay, startOfDay } from 'date-fns';
import { toast } from 'ngx-sonner';
import { injectCallService } from 'src/app/api/connect_clients';
import { CallLogTableComponent } from 'src/app/components/callog-table';
import { TkdDatePickerComponent } from 'src/app/components/date-picker';
import { HeaderTitleService } from 'src/app/layout/header-title';

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
    DecimalPipe
  ]
})
export class CallLogComponent implements OnInit {


  protected readonly distinctCallers = computed(() => {
    const logs = this.logs();
    const set = new Set<string>();
    
    logs.forEach(entry => set.add(entry.caller))
    
    return set.size;
  })

  protected readonly missedCalls = computed(() => {
    const logs = this.logs();

    return logs
      .filter(entry => !entry.callType)    
      .length;
  })

  protected readonly totalCallTime = computed(() => {
    const logs = this.logs();
    
    return logs.reduce((sum, current) => {
      return sum + current.duration.seconds
    }, BigInt(0))
  })
  
  private readonly header = inject(HeaderTitleService);
  
  protected readonly logs = signal<CallEntry[]>([]);
  protected readonly loading = signal(false);
  protected readonly dateRange = signal<[Date, Date]>((() => {
    const now = new Date();
    return [
      startOfDay(now),
      endOfDay(now),
    ]
  })())

  private callService = injectCallService();
  
  constructor() {
    effect(() => {
      const range = this.dateRange();

      this.loading.set(true);

      this.callService
        .searchCallLogs({
          timeRange: {
            from: Timestamp.fromDate(range[0]),
            to: Timestamp.fromDate(range[1]),
          }
        })
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
          this.logs.set(response.results);
        })
      
    }, { allowSignalWrites: true })
  }

  ngOnInit(): void {
    this.header.set('Anruf Journal', 'Protokol der eingehenden und ausgehenden Telefonate.');
  }
}
