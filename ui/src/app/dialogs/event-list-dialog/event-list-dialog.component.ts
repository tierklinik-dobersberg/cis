import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  model,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Timestamp } from '@bufbuild/protobuf';
import { Code, ConnectError } from '@connectrpc/connect';
import {
  lucideArrowLeft,
  lucideArrowRight,
  lucideCalendar,
} from '@ng-icons/lucide';
import {
  BrnDialogRef,
  injectBrnDialogContext,
} from '@spartan-ng/ui-dialog-brain';
import {
  injectUserProfiles
} from '@tierklinik-dobersberg/angular/behaviors';
import { HlmButtonDirective } from '@tierklinik-dobersberg/angular/button';
import { HlmCheckboxModule } from '@tierklinik-dobersberg/angular/checkbox';
import {
  injectCalendarService,
  injectRosterService
} from '@tierklinik-dobersberg/angular/connect';
import {
  HlmDialogDescriptionDirective,
  HlmDialogFooterComponent,
  HlmDialogHeaderComponent,
  HlmDialogService,
  HlmDialogTitleDirective,
} from '@tierklinik-dobersberg/angular/dialog';
import {
  HlmIconModule,
  provideIcons,
} from '@tierklinik-dobersberg/angular/icon';
import { HlmLabelDirective } from '@tierklinik-dobersberg/angular/label';
import {
  DisplayNamePipe,
  DurationPipe,
} from '@tierklinik-dobersberg/angular/pipes';
import { HlmTableModule } from '@tierklinik-dobersberg/angular/table';
import { Calendar, CalendarEvent, EventSource, ListEventsRequest, ListEventsResponse } from '@tierklinik-dobersberg/apis/calendar/v1';
import { GetUserShiftsResponse, PlannedShift } from '@tierklinik-dobersberg/apis/roster/v1';
import { endOfDay, startOfDay } from 'date-fns';
import { toast } from 'ngx-sonner';
import { AppAvatarComponent } from 'src/app/components/avatar';
import {
  TkdDatePickerComponent,
  TkdDatePickerInputDirective,
} from 'src/app/components/date-picker';
import { TkdDatePickerTriggerComponent } from 'src/app/components/date-picker/picker-trigger';
import { AppEventListComponent } from 'src/app/components/event-list';
import { getSeconds } from 'src/app/pages/calendar2/day-view/sort.pipe';
import { getCalendarId } from 'src/app/services';
import { toDateString } from 'src/app/utils';
import { findCalendarHoles, mergePlannedShifts } from 'src/app/utils/calendar';
import { sortCalendarEvents } from 'src/app/utils/calendar/sorting';
import { injectLocalPlannedShifts } from 'src/app/utils/shifts';

export type EventListDialogContext = {
  date: Date;
} & ({ userId: string } | { calendarId: string });

const contentClass =
  'flex flex-col w-screen overflow-hidden max-w-[unset] sm:w-[750px] md:w-[750px] h-[100dvh] sm:h-[unset] sm:h-[80vh]';

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
  standalone: true,
  imports: [
    HlmTableModule,
    HlmButtonDirective,
    HlmIconModule,
    HlmLabelDirective,
    HlmDialogHeaderComponent,
    HlmDialogTitleDirective,
    HlmDialogDescriptionDirective,
    HlmDialogFooterComponent,
    AppAvatarComponent,
    AppEventListComponent,
    DatePipe,
    HlmCheckboxModule,
    FormsModule,
    TkdDatePickerComponent,
    TkdDatePickerInputDirective,
    TkdDatePickerTriggerComponent,
    DisplayNamePipe,
    FormsModule,
  ],
  providers: [
    ...provideIcons({
      lucideCalendar,
      lucideArrowLeft,
      lucideArrowRight,
    }),
  ],
  templateUrl: './event-list-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      :host {
        @apply flex h-full w-full flex-grow flex-col overflow-hidden;
      }
    `,
  ],
})
export class EventListDialogComponent {
  private readonly dialogRef = inject(BrnDialogRef);
  private readonly dialogService = inject(HlmDialogService);
  private readonly calendarService = injectCalendarService();
  private readonly rosterService = injectRosterService();

  protected readonly dialogContext =
    injectBrnDialogContext<EventListDialogContext>();
  protected readonly upcoming = model<boolean>(true);
  protected readonly events = signal<CalendarEvent[]>([]);
  protected readonly calendar = signal<Calendar | null>(null);
  protected readonly calendarDate = model<Date>(new Date());
  protected readonly loading = signal(true);

  protected readonly userShifts = signal<PlannedShift[]>([]);

  protected readonly localPlannedShifts = injectLocalPlannedShifts(this.userShifts);

  protected readonly profiles = injectUserProfiles();

  protected readonly user = computed(() => {
    const profiles = this.profiles();

    if ('userId' in this.dialogContext) {
      const id = this.dialogContext.userId;
      return profiles.find(p => p.user.id === id) || null;
    }

    const id = this.dialogContext.calendarId;
    return profiles.find(p => getCalendarId(p) === id) || null;
  });

  protected readonly _computedEvents = computed<EventModel[]>(() => {
    const calendar = this.calendar();
    // abort now if we still don't have any calendars
    if (calendar === null) {
      return [];
    }

    const events = [...this.events()]
      .sort(sortCalendarEvents)
      .map(e => new EventModel(e));

    const shifts = this.localPlannedShifts().filter(shift => {
      // FIXME(ppacher): make the on-call tag configurable
      return !shift.definition.tags.includes('oncall');
    });

    const mergedShifts = mergePlannedShifts(shifts);

    mergedShifts.forEach(shift => {
      const breaks = findCalendarHoles(
        shift.from.toDate(),
        shift.to.toDate(),
        events
      );

      let id = 0;
      breaks.forEach(b => {
        const duration = getSeconds(b.to) - getSeconds(b.from);
        if (duration > 5 * 60) {
          events.push(
            new EventModel(
              new CalendarEvent({
                id: `break-${id++}`,
                calendarId: calendar.id,
                startTime: Timestamp.fromDate(b.from),
                endTime: Timestamp.fromDate(b.to),
                summary:
                  'Freier Slot für ' +
                  new DurationPipe().transform(duration),
              }),
              true,
              'bg-green-50 opacity-75 !font-normal'
            )
          );
        }
      });
    });

    return events;
  });

  protected close() {
    this.dialogRef.close();
  }

  protected openEvent(event: CalendarEvent) {
    import('../event-details-dialog').then(m => {
      m.AppEventDetailsDialogComponent.open(this.dialogService, {
        calendar: this.calendar(),
        event: event,
      }).closed$.subscribe(() => this.load(this.calendarDate()));
    });
  }

  protected load(date: Date) {
    this.loading.set(true);

    const req = new ListEventsRequest({
      searchTime: {
        case: 'date',
        value: toDateString(date)
      },
    });

    if ('userId' in this.dialogContext) {
      req.source = {
        case: 'sources',
        value: new EventSource({
          userIds: [this.dialogContext.userId],
        }),
      };
    } else {
      req.source = {
        case: 'sources',
        value: new EventSource({
          calendarIds: [this.dialogContext.calendarId],
        }),
      };
    }

    this.calendarService
      .listEvents(req)
      .catch(err => {
        const cErr = ConnectError.from(err);

        if (cErr.code !== Code.NotFound) {
          toast.error('Termine konnten nicht geladen werden', {
            description: cErr.message,
          });
        }

        return new ListEventsResponse();
      })
      .then(response => {
        this.events.set(response.results[0]?.events || []);
        this.calendar.set(response.results[0]?.calendar || null);
        this.loading.set(false);
      });
  }

  constructor() {
    this.calendarDate.set(this.dialogContext.date);

    effect(
      () => {
        const date = this.calendarDate();

        this.load(date);
      },
      { allowSignalWrites: true }
    );

    effect(() => {
      const user = this.user();
      const date = this.calendarDate();

      if (user) {
        this.rosterService
          .getUserShifts({
            timerange: {
              from: Timestamp.fromDate(startOfDay(date)),
              to: Timestamp.fromDate(endOfDay(date)),
            },
            users: {
              userIds: [user.user.id],
            },
          })
          .catch(err => {
            const cerr = ConnectError.from(err);

            if (cerr.code !== Code.NotFound) {
              toast.error('Dienste konnte nicht geladen werden', {
                description: cerr.message,
              });
            }

            return new GetUserShiftsResponse();
          })
          .then(response => {
            this.userShifts.set(response.shifts);
          });
      }
    });
  }

  static open(
    service: HlmDialogService,
    ctx: EventListDialogContext
  ): BrnDialogRef<EventListDialogComponent> {
    return service.open(EventListDialogComponent, {
      context: ctx,
      contentClass,
    });
  }
}
