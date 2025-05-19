import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  model,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConnectError } from '@connectrpc/connect';
import { lucideCalendarSearch } from '@ng-icons/lucide';
import { hlm } from '@spartan-ng/ui-core';
import {
  BrnDialogRef
} from '@spartan-ng/ui-dialog-brain';
import { HlmButtonDirective } from '@tierklinik-dobersberg/angular/button';
import { injectCalendarService } from '@tierklinik-dobersberg/angular/connect';
import {
  HlmDialogModule,
  HlmDialogService,
} from '@tierklinik-dobersberg/angular/dialog';
import { TkdEmptyTableComponent } from '@tierklinik-dobersberg/angular/empty-table';
import { HlmIconComponent, provideIcons } from '@tierklinik-dobersberg/angular/icon';
import { HlmInputDirective } from '@tierklinik-dobersberg/angular/input';
import { CalendarEvent } from '@tierklinik-dobersberg/apis/calendar/v1';
import { toast } from 'ngx-sonner';
import { AppEventListComponent } from 'src/app/components/event-list';
import { DIALOG_CONTENT_CLASS } from 'src/app/dialogs/constants';

@Component({
  standalone: true,
  templateUrl: './search-events-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    HlmDialogModule,
    AppEventListComponent,
    HlmInputDirective,
    HlmButtonDirective,
    FormsModule,
    HlmIconComponent,
    TkdEmptyTableComponent,
  ],
  providers: [
    ...provideIcons({lucideCalendarSearch})
  ],
  host: {
    'class': 'overflow-y-hidden h-full flex flex-col gap-4'
  }
})
export class SearchEventsDialogComponent {
  private readonly calendarService = injectCalendarService();
  private readonly dialogRef = inject(BrnDialogRef);

  protected readonly searchText = model<string>('');
  protected readonly events = signal<CalendarEvent[]>([]);
  protected readonly loading = signal(false);

  static open(service: HlmDialogService): BrnDialogRef<unknown> {
    return service.open(SearchEventsDialogComponent, {
      contentClass: hlm(DIALOG_CONTENT_CLASS, "md:max-h-[90vh] md:h-[90vh] overflow-hidden"),
    });
  }

  public close() {
    this.dialogRef.close();
  }

  constructor() {
    let abrt: AbortController | null = null;
    let timeout: any | null = null;

    effect(() => {
      const text = this.searchText();

      if (abrt) {
        abrt.abort();
        abrt = null;
      }

      if (timeout !== null) {
        clearTimeout(timeout)
        timeout = null;
      }

      if (!text || text.length < 3) {
        this.events.set([])
        return;
      }

      timeout = setTimeout(() => {
        this.loading.set(true);
        abrt = new AbortController();
        this.calendarService
          .listEvents({
            searchText: text,
            searchTime: {
              case: 'timeRange',
              value: {},
            },
            source: {
                case: 'allCalendars',
                value: true
            }
          })
          .finally(() => {
            abrt = null
            this.loading.set(false)
          })
          .then(response => {
            const events: CalendarEvent[] = [];

            response.results.forEach(cal => {
              cal.events.forEach(e => events.push(e));
            });

            this.events.set(events);
          })
          .catch(err => {
            toast.error('Termine konnten nicht durchsucht werden', {
              description: ConnectError.from(err).message,
            });
          });
      }, 500);
    }, { allowSignalWrites: true });
  }
}
