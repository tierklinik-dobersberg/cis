import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  model,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ConnectError } from '@connectrpc/connect';
import { BrnSelectModule } from '@spartan-ng/ui-select-brain';
import { injectUserProfiles, sortProtoTimestamps } from '@tierklinik-dobersberg/angular/behaviors';
import { HlmCardModule } from '@tierklinik-dobersberg/angular/card';
import { HlmCheckboxModule } from '@tierklinik-dobersberg/angular/checkbox';
import {
  injectCalendarService,
  injectRosterService,
} from '@tierklinik-dobersberg/angular/connect';
import {
  HlmIconModule,
  provideIcons,
} from '@tierklinik-dobersberg/angular/icon';
import { HlmSelectModule } from '@tierklinik-dobersberg/angular/select';
import { CalenarEventRequestKind, Calendar, CalendarChangeEvent, CalendarEvent, ListEventsResponse } from '@tierklinik-dobersberg/apis/calendar/v1';
import { toast } from 'ngx-sonner';
import { debounceTime } from 'rxjs';
import {
  TkdDatePickerComponent,
  TkdDatePickerInputDirective,
} from 'src/app/components/date-picker';
import { TkdDatePickerTriggerComponent } from 'src/app/components/date-picker/picker-trigger';
import { AppEventListComponent } from 'src/app/components/event-list';
import { EventService } from 'src/app/services/event.service';
import { toDateString } from 'src/app/utils';

class EventModel extends CalendarEvent {
  constructor(
    event: CalendarEvent,
    public readonly classes = ''
  ) {
    super(event);
  }
}

@Component({
  selector: 'app-upcoming-events-card',
  templateUrl: './upcoming-events-card.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    HlmCardModule,
    TkdDatePickerComponent,
    TkdDatePickerInputDirective,
    TkdDatePickerTriggerComponent,
    HlmIconModule,
    AppEventListComponent,
    BrnSelectModule,
    HlmSelectModule,
    FormsModule,
    HlmCheckboxModule,
    BrnSelectModule,
    HlmSelectModule, 
    DatePipe
  ],
  standalone: true,
  host: {
    class: '@container flex flex-grow overflow-hidden flex-shrink-0 max-h-[calc(100dvh-80px)]',
  },
  providers: [...provideIcons({})],
})
export class UpcomingEventsCardComponent {
  protected readonly calendarService = injectCalendarService();
  protected readonly rosterService = injectRosterService();

  protected readonly events = signal<CalendarEvent[]>([]);
  protected readonly calendars = signal<Calendar[]>([]);
  protected readonly loading = signal(true);
  protected readonly calendarDate = signal(new Date());
  protected readonly profiles = injectUserProfiles();

  protected readonly eventsToShow = model<'all' | 'upcoming' | 'breaks'>('upcoming');

  public readonly displayedCalendars = input<string[]>([]);

  protected readonly _computedEvents = computed(() => {
    const events = this.events();
    const display = this.displayedCalendars();
    const eventsToShow = this.eventsToShow();

    const result =  events
      .filter(e => {
        switch (eventsToShow) {
          case 'all':
            break;

          case 'breaks':
            if (e.isFree) {
              break
            }

            return false
        }

        if (!display || display.length === 0) {
          return true
        }

        return display.includes(e.calendarId);
      });

      return result
  });

  constructor() {
    effect(
      () => {
        // trigger on each calendar date change
        this.calendarDate();

        this.loading.set(true);
        this.load();
      },
      { allowSignalWrites: true }
    );

    inject(EventService)
      .subscribe(new CalendarChangeEvent)
      .pipe(takeUntilDestroyed(), debounceTime(1000))
      .subscribe(() => this.load())

    const interval = setInterval(() => this.load(), 1000 * 60 * 10) // reload every 10 minutes
    inject(DestroyRef)
      .onDestroy(() => clearInterval(interval))
  }

  private _lastListEventsResponse: ListEventsResponse | null;

  protected load() {
    const date = this.calendarDate();

    this.calendarService
      .listEvents({
        searchTime: {
          case: 'date',
          value: toDateString(date),
        },
        source: {
          case: 'allCalendars',
          value: true,
        },
        requestKinds: [
          CalenarEventRequestKind.CALENDAR_EVENT_REQUEST_KIND_EVENTS,
          CalenarEventRequestKind.CALENDAR_EVENT_REQUEST_KIND_FREE_SLOTS,
        ]
      })
      .catch(err => {
        toast.error('Termine konnten nicht geladen werden', {
          description: ConnectError.from(err).message,
        });

        return new ListEventsResponse();
      })
      .then(response => {

        if (response.equals(this._lastListEventsResponse)) {
          console.log("list event response unchanged")
          return
        }
        console.log("changed calendar list response", response, this._lastListEventsResponse)
        
        this._lastListEventsResponse = response;

        const events: CalendarEvent[] = [];
        const calendars: Calendar[] = [];

        response.results.forEach(list => {
          calendars.push(list.calendar);
          list.events.forEach(e => events.push(e));
        });

        events.sort((a, b) => {
          let result = sortProtoTimestamps(a.startTime, b.startTime);
          if (result === 0) {
            result = sortProtoTimestamps(a.endTime, b.endTime);
          }

          if (result === 0) {
            return a.summary.localeCompare(b.summary);
          }

          return result;
        });

        this.events.set(events);
        this.calendars.set(calendars);
        this.loading.set(false);
      });
  }
}
