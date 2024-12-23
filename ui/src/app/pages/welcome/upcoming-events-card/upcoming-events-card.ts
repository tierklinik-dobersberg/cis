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
import { Timestamp } from '@bufbuild/protobuf';
import { ConnectError } from '@connectrpc/connect';
import { BrnSelectModule } from '@spartan-ng/ui-select-brain';
import { injectUserProfiles, sortProtoTimestamps } from '@tierklinik-dobersberg/angular/behaviors';
import { HlmButtonDirective } from '@tierklinik-dobersberg/angular/button';
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
import { HlmLabelDirective } from '@tierklinik-dobersberg/angular/label';
import { DisplayNamePipe, DurationPipe } from '@tierklinik-dobersberg/angular/pipes';
import { HlmSelectModule } from '@tierklinik-dobersberg/angular/select';
import { Calendar, CalendarChangeEvent, CalendarEvent, ListEventsResponse } from '@tierklinik-dobersberg/apis/calendar/v1';
import { TimeRange } from '@tierklinik-dobersberg/apis/common/v1';
import { GetWorkingStaffResponse, PlannedShift } from '@tierklinik-dobersberg/apis/roster/v1';
import { endOfDay, startOfDay } from 'date-fns';
import { toast } from 'ngx-sonner';
import { debounceTime } from 'rxjs';
import {
  TkdDatePickerComponent,
  TkdDatePickerInputDirective,
} from 'src/app/components/date-picker';
import { TkdDatePickerTriggerComponent } from 'src/app/components/date-picker/picker-trigger';
import { AppEventListComponent } from 'src/app/components/event-list';
import { getCalendarId } from 'src/app/services';
import { EventService } from 'src/app/services/event.service';
import { toDateString } from 'src/app/utils';
import { findCalendarHoles, mergePlannedShifts } from 'src/app/utils/calendar';
import { injectLocalPlannedShifts } from 'src/app/utils/shifts';

class EventModel extends CalendarEvent {
  constructor(
    event: CalendarEvent,
    public readonly isBreak = false,
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
    HlmButtonDirective,
    TkdDatePickerComponent,
    TkdDatePickerInputDirective,
    TkdDatePickerTriggerComponent,
    HlmIconModule,
    AppEventListComponent,
    BrnSelectModule,
    HlmSelectModule,
    FormsModule,
    HlmCheckboxModule,
    HlmLabelDirective,
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
  protected readonly shifts = signal<PlannedShift[]>([]);
  protected readonly profiles = injectUserProfiles();

  protected readonly eventsToShow = model<'all' | 'upcoming' | 'breaks'>('upcoming');

  public readonly displayedCalendars = input<string[]>([]);

  protected readonly plannedShifts = injectLocalPlannedShifts(this.shifts);

  protected readonly _computedBreaks = computed(() => {
    const shifts = this.plannedShifts();
    const profiles = this.profiles();
    const events = this.events();


    // Get a list of unique user ids that are working today.
    const workingUsers = new Set<string>();
    shifts
      .filter(shift => !shift.definition.tags.includes("oncall")) // FIXME(ppacher): make this configurable
      .forEach(shift => shift.assignedUserIds.forEach(userId => workingUsers.add(userId)))

    const breaks: EventModel[] = [];

    for(let userId of workingUsers.values()) {
      const profile = profiles.find(p => p.user.id === userId);
      const calendarId = getCalendarId(profile);

      if (!calendarId) {
        continue
      }

      const userShifts = shifts.filter(shift => shift.assignedUserIds.includes(userId) && !shift.definition.tags.includes("oncall")); // FIXME
      const merged = mergePlannedShifts(userShifts);
      const userEvents = events.filter(e => e.calendarId === calendarId)

      let i = 0;
      merged.forEach(range => {
        const userBreaks = findCalendarHoles(range.from.toDate(), range.to.toDate(), userEvents);

        userBreaks.forEach(b => {
          breaks.push(new EventModel(
            new CalendarEvent({
              startTime: Timestamp.fromDate(b.from),
              endTime: Timestamp.fromDate(b.to),
              calendarId: calendarId,
              summary: 'Freier Slot für ' + ( (new DisplayNamePipe()).transform(profile)) + ' (' + new DurationPipe().transform(b.duration, 'default-hours') + ')',
              id: `break-${userId}-${i++}`,
            }),
            true,
            'bg-blue-50 opacity-75'
          ))
        })
      })
    }

    return breaks;
  })

  protected readonly _computedEvents = computed(() => {
    const events = this.events();
    const breaks = this._computedBreaks();
    const display = this.displayedCalendars();
    const eventsToShow = this.eventsToShow();

    const all = [...breaks, ...events];

    return all
      .filter(e => {
        if (eventsToShow === 'breaks') {
          if (!(e instanceof EventModel) || !e.isBreak) {
            return false;
          }
        }

        if (!display || display.length === 0) {
          return true
        }

        return display.includes(e.calendarId);
      });
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

    const range = new TimeRange({
      from: Timestamp.fromDate(startOfDay(date)),
      to: Timestamp.fromDate(endOfDay(date)),
    });

    this.rosterService
      .getWorkingStaff2({
        query: {
          case: 'timeRange',
          value: range,
        },
      })
      .catch(err => {
        toast.error('Dienst konnte nicht geladen werden', {
          description: ConnectError.from(err).message,
        });

        return new GetWorkingStaffResponse();
      })
      .then(response => {
        const newResponse = new GetWorkingStaffResponse({currentShifts: response.currentShifts});
        const oldResponse = new GetWorkingStaffResponse({currentShifts: this.shifts()})

        if (newResponse.equals(oldResponse)) {
          console.log("not updating shifts, responses are equal")
          return
        }

        this.shifts.set(response.currentShifts)
      });

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
