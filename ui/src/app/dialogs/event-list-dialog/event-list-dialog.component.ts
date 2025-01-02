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
  injectCalendarService
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
  DisplayNamePipe
} from '@tierklinik-dobersberg/angular/pipes';
import { HlmTableModule } from '@tierklinik-dobersberg/angular/table';
import { CalenarEventRequestKind, Calendar, CalendarEvent, EventSource, ListEventsRequest, ListEventsResponse } from '@tierklinik-dobersberg/apis/calendar/v1';
import { toast } from 'ngx-sonner';
import {
  TkdDatePickerComponent,
  TkdDatePickerInputDirective,
} from 'src/app/components/date-picker';
import { TkdDatePickerTriggerComponent } from 'src/app/components/date-picker/picker-trigger';
import { AppEventListComponent } from 'src/app/components/event-list';
import { getCalendarId } from 'src/app/services';
import { toDateString } from 'src/app/utils';

export type EventListDialogContext = {
  date: Date;
} & ({ userId: string } | { calendarId: string });

const contentClass =
  'flex flex-col w-screen overflow-hidden max-w-[unset] sm:w-[750px] md:w-[750px] h-[100dvh] sm:h-[unset] sm:h-[80vh]';

class EventModel extends CalendarEvent {
  constructor(
    event: CalendarEvent,
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

  protected readonly dialogContext =
    injectBrnDialogContext<EventListDialogContext>();
  protected readonly upcoming = model<boolean>(true);
  protected readonly events = signal<CalendarEvent[]>([]);
  protected readonly calendar = signal<Calendar | null>(null);
  protected readonly calendarDate = model<Date>(new Date());
  protected readonly loading = signal(true);

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
      requestKinds: [
        CalenarEventRequestKind.CALENDAR_EVENT_REQUEST_KIND_EVENTS,
        CalenarEventRequestKind.CALENDAR_EVENT_REQUEST_KIND_FREE_SLOTS
      ]
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
