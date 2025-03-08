import { CommonModule, DatePipe, DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  LOCALE_ID,
  model,
  OnDestroy,
  OnInit,
  Renderer2,
  signal,
  untracked,
  ViewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { PlainMessage, Timestamp } from '@bufbuild/protobuf';
import { ConnectError } from '@connectrpc/connect';
import { lucideStar, lucideZoomIn, lucideZoomOut } from '@ng-icons/lucide';
import { BrnSelectModule } from '@spartan-ng/ui-select-brain';
import {
  injectUserProfiles,
  sortUserProfile,
} from '@tierklinik-dobersberg/angular/behaviors';
import { HlmButtonModule } from '@tierklinik-dobersberg/angular/button';
import { HlmCheckboxComponent } from '@tierklinik-dobersberg/angular/checkbox';
import {
  CALENDAR_SERVICE,
  ROSTER_SERVICE,
} from '@tierklinik-dobersberg/angular/connect';
import { HlmDialogService } from '@tierklinik-dobersberg/angular/dialog';
import {
  HlmIconModule,
  provideIcons,
} from '@tierklinik-dobersberg/angular/icon';
import { HlmLabelDirective } from '@tierklinik-dobersberg/angular/label';
import { LayoutService } from '@tierklinik-dobersberg/angular/layout';
import {
  DurationPipe,
  getUserColor,
  ToDatePipe,
} from '@tierklinik-dobersberg/angular/pipes';
import { HlmSelectModule } from '@tierklinik-dobersberg/angular/select';
import { HlmTabsModule } from '@tierklinik-dobersberg/angular/tabs';
import {
  CalenarEventRequestKind,
  CalendarChangeEvent,
  CalendarEvent,
  CustomerAnnotation,
  ListEventsResponse,
  Calendar as PbCalendar,
} from '@tierklinik-dobersberg/apis/calendar/v1';
import { Profile } from '@tierklinik-dobersberg/apis/idm/v1';
import {
  ListRosterTypesResponse,
  PlannedShift,
  RosterType,
  WorkShift,
} from '@tierklinik-dobersberg/apis/roster/v1';
import {
  addDays,
  differenceInSeconds,
  endOfDay,
  getMinutes,
  isAfter,
  isBefore,
  isSameDay,
  setMinutes,
  setSeconds,
  startOfDay,
} from 'date-fns';
import { toast } from 'ngx-sonner';
import { debounceTime, filter, map } from 'rxjs';
import {
  TkdDatePickerComponent,
  TkdDatePickerInputDirective,
} from 'src/app/components/date-picker';
import { TkdDatePickerTriggerComponent } from 'src/app/components/date-picker/picker-trigger';
import { UserColorVarsDirective } from 'src/app/components/user-color-vars';
import { HeaderTitleService } from 'src/app/layout/header-title';
import { NavigationService } from 'src/app/layout/navigation/navigation.service';
import { ByCalendarIdPipe } from 'src/app/pipes/by-calendar-id.pipe';
import { ContrastColorPipe } from 'src/app/pipes/contrast-color.pipe';
import { ToRGBAPipe } from 'src/app/pipes/to-rgba.pipe';
import { getCalendarId } from 'src/app/services';
import { EventService } from 'src/app/services/event.service';
import { toDateString } from 'src/app/utils';
import { storedSignal } from 'src/app/utils/stored-signal';
import {
  AppEventDetailsDialogComponent,
  EventDetailsDialogContext,
} from '../../../dialogs/event-details-dialog';
import { RosterCardComponent } from '../../welcome/roster-card';
import {
  Calendar,
  CalendarMouseEvent,
  DEFAULT_HOUR_HEIGHT_PX,
  SwipeEvent,
  Timed,
  TkdCalendarEventCellTemplateDirective,
  TkdCalendarHeaderCellTemplateDirective,
  TkdDayViewComponent,
} from '../day-view';
import { getSeconds } from '../day-view/sort.pipe';

type CalEvent = Timed &
  PlainMessage<CalendarEvent> & {
    isShiftType?: boolean;
    isOnCall?: boolean;
    colorOverwrite?: string;
    customerId?: string;
  };

@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'tkd-calendar-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './calendar-view.component.html',
  standalone: true,
  imports: [
    CommonModule,
    TkdDayViewComponent,
    TkdCalendarHeaderCellTemplateDirective,
    TkdCalendarEventCellTemplateDirective,
    HlmLabelDirective,
    HlmCheckboxComponent,
    FormsModule,
    HlmButtonModule,
    UserColorVarsDirective,
    HlmIconModule,
    TkdDatePickerComponent,
    TkdDatePickerInputDirective,
    TkdDatePickerTriggerComponent,
    BrnSelectModule,
    HlmSelectModule,
    ByCalendarIdPipe,
    DurationPipe,
    ToDatePipe,
    ToRGBAPipe,
    HlmTabsModule,
    ContrastColorPipe,
    RosterCardComponent,
  ],
  providers: [
    ...provideIcons({
      lucideZoomIn,
      lucideZoomOut,
      lucideStar,
    }),
  ],
  styles: [
    `
      :host {
        @apply flex h-full flex-col pb-8 xl:flex-row xl:!p-0;
      }
      .event-container {
        container-type: size;
      }

      @container (max-width: 100px) {
        .event-summary {
          @apply flex-col gap-0;
        }

        .event-duration {
          @apply hidden;
        }
      }

      @container (max-height: 1.5rem) {
        .event-details {
          @apply flex flex-row flex-nowrap items-center py-0;
          font-size: 75%;
        }
      }

      @container (max-height: 54px) {
        .event-details {
          @apply flex flex-row flex-nowrap items-center;
        }
      }

      @container (min-height: 55px) {
        .event-description {
          display: block;
        }
      }
    `,
  ],
})
export class TkdCalendarViewComponent implements OnInit, OnDestroy {
  private readonly calendarAPI = inject(CALENDAR_SERVICE);
  private readonly rosterAPI = inject(ROSTER_SERVICE);
  private readonly activeRoute = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly renderer = inject(Renderer2);
  private readonly document = inject(DOCUMENT);
  private readonly dialog = inject(HlmDialogService);
  private readonly header = inject(HeaderTitleService);

  protected readonly navService = inject(NavigationService);
  protected readonly layout = inject(LayoutService);

  protected readonly isToday = computed(() => {
    const date = this.currentDate();
    if (!date) {
      return;
    }

    return isSameDay(date, new Date());
  });

  protected readonly currentDate = signal<Date | null>(null);

  /** A list of available calendars */
  protected readonly allCalendars = signal<PbCalendar[]>([]);

  protected readonly workingStaff = computed(() => {
    const shifts = this.shifts();
    const workingStaff = new Set<string>();

    shifts.forEach(shift => {
      shift.assignedUserIds.forEach(user => workingStaff.add(user));
    });

    return workingStaff;
  });

  protected readonly calendars = computed(() => {
    const profiles = this.profiles();
    const calendars = this.allCalendars();
    const displayed = new Set(this.displayedCalendars());
    const workingStaff = this.workingStaff();

    const profileLookupMap = new Map<string, Profile>();
    profiles.forEach(p => {
      const calId = getCalendarId(p);
      if (calId) {
        profileLookupMap.set(calId, p);
      }
    });

    return calendars
      .filter(cal => {
        if (displayed.has(cal.id)) {
          return true;
        }

        const profile = profileLookupMap.get(cal.id);
        if (!profile) {
          return true;
        }

        // display the user even if it has been deleted
        // if it was still assigned to a working shift on the current date.
        if (workingStaff.has(profile.user.id)) {
          return true;
        }

        if (profile.user.deleted) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        let ap = profileLookupMap.get(a.id);
        let bp = profileLookupMap.get(b.id);

        if (ap && ap.user.deleted) {
          ap = null;
        }

        if (bp && bp.user.deleted) {
          bp = null;
        }

        let av = ap ? (workingStaff.has(ap.user.id) ? 2 : 1) : -1;
        let bv = bp ? (workingStaff.has(bp.user.id) ? 2 : 1) : -1;

        const result = bv - av;
        if (result === 0) {
          return sortUserProfile(bp, ap);
        }

        return result;
      });
  });

  protected readonly sizeFactor = storedSignal(
    'cis:calendar:sizeFactor',
    DEFAULT_HOUR_HEIGHT_PX / 60 / 60
  );

  /** The user profiles */
  protected readonly profiles = injectUserProfiles();

  /** A list of calendar ids to display */
  protected readonly displayedCalendars = model<string[]>([]);

  protected readonly shifts = signal<PlannedShift[]>([]);
  protected readonly shiftDefinitions = signal<WorkShift[]>([]);
  protected readonly rosterTypes = signal<null | RosterType[]>([]);
  protected readonly eventListResponse = signal<ListEventsResponse | null>(
    null
  );

  protected readonly events = computed(() => {
    const response = this.eventListResponse();
    const profiles = this.profiles();

    if (!response) {
      return [];
    }

    let events: CalEvent[] = [];
    response.results.forEach(eventList => {
      const isVirtual = eventList.calendar.isVirtualResource || false;
      eventList.events.forEach(evt => {
        let color: string | undefined = undefined;

        if (isVirtual) {
          const profile = profiles.find(
            p => getCalendarId(p) === evt.calendarId
          );

          if (profile) {
            color = getUserColor(profile);
          } else {
            let calendar = response.results.find(
              r =>
                r.calendar.id === evt.calendarId &&
                !r.calendar.isVirtualResource
            )?.calendar;

            if (calendar) {
              color = calendar.color;
            }
          }
        }

        let customerAnnotation: CustomerAnnotation | null = null;
        if (evt.extraData) {
          customerAnnotation = new CustomerAnnotation();
          if (!evt.extraData.unpackTo(customerAnnotation)) {
            customerAnnotation = null;
          }
        }

        events.push({
          ...evt,
          from: evt.startTime,
          duration: getSeconds(evt.endTime) - getSeconds(evt.startTime),
          uniqueId: isVirtual ? eventList.calendar.id + ':' + evt.id : evt.id,
          colorOverwrite: color,
          customerId: customerAnnotation
            ? customerAnnotation.customerId
            : undefined,
        });
      });
    });

    return events;
  });

  protected readonly _computedShiftEvents = computed(() => {
    const shifts = this.shifts();
    const profiles = this.profiles();
    const date = startOfDay(this.currentDate());
    const types = this.rosterTypes();

    const definitions = this.shiftDefinitions();
    const lm = new Map<string, WorkShift>();

    definitions.forEach(def => lm.set(def.id, def));

    const profileById = new Map<string, Profile>();
    profiles.forEach(p => {
      profileById.set(p.user.id, p);
    });

    const shiftEvents: CalEvent[] = [];

    shifts.forEach(shift => {
      let from = getSeconds(shift.from);
      let fromDate = shift.from.toDate();
      let toDate = shift.to.toDate();

      if (isBefore(fromDate, date)) {
        fromDate = date;
        from = 0;
      }

      if (isAfter(toDate, endOfDay(date))) {
        toDate = endOfDay(date);
      }

      const duration = differenceInSeconds(toDate, fromDate);
      const def = definitions.find(w => w.id === shift.workShiftId);
      const rosterTypes = types.filter(t =>
        def.tags.some(tag => t.shiftTags.includes(tag))
      );

      shift.assignedUserIds
        .map(id => profileById.get(id))
        .filter(profile => !!profile)
        .forEach(profile => {
          const calendarId = getCalendarId(profile);
          if (!calendarId) {
            return;
          }

          const id =
            'shift:' +
            profile.user.id +
            ':' +
            shift.workShiftId +
            ':' +
            shift.from.toDate().toISOString() +
            '-' +
            shift.to.toDate().toISOString() +
            '-' +
            def.tags.join(':');

          shiftEvents.push({
            calendarId: calendarId,
            summary: lm.get(shift.workShiftId)?.name || 'unknown',
            from: from,
            duration: duration,
            fullDay: false,
            isFree: false,
            isOnCall: rosterTypes.some(type =>
              type.onCallTags.some(tag => def.tags.includes(tag))
            ),
            colorOverwrite: def.color,
            resources: [],
            virtualCopy: false,
            id: id,
            uniqueId: id,
            description: '',
            ignoreOverlapping: true,
            isShiftType: true,
          });
        });
    });

    return shiftEvents;
  });

  protected readonly loading = signal<('types' | 'shifts' | 'events')[]>([]);

  protected readonly _computedEvents = computed(() => {
    const shiftEvents = this._computedShiftEvents();
    const events = this.events();

    return [...shiftEvents, ...events];
  });

  protected readonly calendarType: Calendar = null;

  @ViewChild(TkdDayViewComponent, { static: true })
  dayViewComponent!: TkdDayViewComponent<CalEvent>;

  private handleKeyPress(event: KeyboardEvent) {
    if (event.key === '+') {
      this.dayViewComponent?.zoomIn();
    }

    if (event.key === '-') {
      this.dayViewComponent?.zoomOut();
    }
  }

  handleCalendarClick(event: CalendarMouseEvent<CalEvent, Calendar>) {
    let ctx: EventDetailsDialogContext = {
      calendar: new PbCalendar(event.calendar),
    };

    if (event.doubleClick) {
      // clear out the seconds and round mintues to the nearest multiple of 15
      let date = setSeconds(event.date, 0);
      date = setMinutes(date, Math.round(getMinutes(date) / 15) * 15);

      ctx.startTime = date;
    } else if (event.clickedEvent && !event.clickedEvent.isShiftType) {
      ctx.event = new CalendarEvent(event.clickedEvent);

      if (ctx.event.virtualCopy) {
        ctx.calendar = this.allCalendars().find(
          cal => !cal.isVirtualResource && cal.id === ctx.event.calendarId
        );
      }
    } else {
      return;
    }

    AppEventDetailsDialogComponent.open(this.dialog, ctx)
      .closed$.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadEvents(this.currentDate()));
  }

  loadToday() {
    this.setDate(new Date());
  }

  protected toggleUser(user: string) {
    const calendars = this.displayedCalendars();
    if (calendars.includes(user)) {
      this.displayedCalendars.set(calendars.filter(c => c != user));
    } else {
      this.displayedCalendars.set([...calendars, user]);
    }
  }

  setDate(date: Date) {
    this.router.navigate([], {
      queryParams: {
        d: toDateString(date),
      },
      queryParamsHandling: 'merge',
    });
  }

  constructor() {
    const localeId = inject(LOCALE_ID);
    const datePipe = new DatePipe(localeId);

    if (
      window.localStorage &&
      typeof window.localStorage.getItem === 'function'
    ) {
      const shouldHide = window.localStorage.getItem('cis:calendar:hideMenu');

      this.navService.forceHide.set(
        shouldHide === null ? this.layout.xxl() : shouldHide === 'true'
      );

      effect(() => {
        const forceHide = this.navService.forceHide();

        if (forceHide) {
          window.localStorage.setItem('cis:calendar:hideMenu', 'true');
        } else {
          window.localStorage.setItem('cis:calendar:hideMenu', 'false');
        }
      });
    } else {
      this.navService.forceHide.set(true);
    }

    inject(EventService)
      .subscribe(new CalendarChangeEvent())
      .pipe(takeUntilDestroyed(), debounceTime(1000))
      .subscribe(() => this.loadEvents(this.currentDate()));

    effect(
      () => {
        const date = this.currentDate();

        if (!date) {
          return;
        }

        this.header.set(
          'Kalender',
          'Termine am ' + datePipe.transform(date, 'fullDate')
        );

        this.loading.set([]);

        // clear out the shifts so we don't display anything until we got the new response.
        this.shifts.set([]);

        this.rosterAPI
          .getUserShifts({
            timerange: {
              from: Timestamp.fromDate(startOfDay(date)),
              to: Timestamp.fromDate(endOfDay(date)),
            },
            users: {
              allUsers: true,
            },
          })
          .then(response => {
            this.shiftDefinitions.set(response.definitions);
            this.shifts.set(response.shifts);

            this.loading.set([...this.loading(), 'shifts']);
          });

        this.rosterAPI
          .listRosterTypes({})
          .catch(err => {
            toast.error('Failed to load roster types', {
              description: ConnectError.from(err).message,
            });

            return new ListRosterTypesResponse();
          })
          .then(response => {
            this.rosterTypes.set(response.rosterTypes || null);

            this.loading.set([...this.loading(), 'types']);
          });

        this.loadEvents(date);
      },
      {
        allowSignalWrites: true,
      }
    );

    effect(
      () => {
        let _ = this._computedEvents();
        const loading = this.loading();

        if (loading.length === 3) {
          this.resetDisplayedCalendars()
        }
      },
      { allowSignalWrites: true }
    );
  }

  protected handleCalendarHeaderClick(cal: Calendar) {
    const display = this.displayedCalendars();
    if (display.length === 1 && display[0] === cal.id) {
      this.resetDisplayedCalendars()
    } else {
      this.displayedCalendars.set([cal.id])
    }
  }

  protected resetDisplayedCalendars() {
    const events = this._computedEvents();
    const set = new Set<string>();

    events.forEach(evt => {
      set.add(evt.calendarId);
    });

    const values = Array.from(set.values());
    this.displayedCalendars.set(values);
  }

  private _abrt: AbortController | null;
  private _prevDate: Date | null = null;

  private loadEvents(date: Date) {
    if (!isSameDay(date, this._prevDate)) {
      this.eventListResponse.set(null);
    }

    if (this._abrt) {
      this._abrt.abort();
    }

    const abrt = new AbortController();
    this._abrt = abrt;

    const toastId = untracked(() =>
      toast.loading('Termine werden geladen', {
        dismissable: false,
        duration: 60 * 1000,
      })
    );

    this.calendarAPI
      .listEvents(
        {
          searchTime: {
            case: 'date',
            value: toDateString(date),
          },
          source: {
            case: 'allCalendars',
            value: true,
          },
          requestKinds: [
            CalenarEventRequestKind.CALENDAR_EVENT_REQUEST_KIND_VIRTUAL_RESOURCES,
            CalenarEventRequestKind.CALENDAR_EVENT_REQUEST_KIND_EVENTS,
          ],
        },
        { signal: this._abrt.signal }
      )
      .then(response => {
        this.eventListResponse.set(response || null);

        console.log('successfully loaded events for ', date);
        this._prevDate = date;
        this.loading.set([...this.loading(), 'events']);
      })
      .catch(err => {
        console.error('failed to load events', err);
      })
      .finally(() => {
        if (this._abrt === abrt) {
          this._abrt = null;
        }

        toast.dismiss(toastId);
      });
  }

  ngOnInit(): void {
    this.calendarAPI
      .listCalendars({ includeVirtualResourceCalendars: true })
      .then(response => {
        const calendars = response.calendars.sort((a, b) =>
          a.id.localeCompare(b.id)
        );

        this.allCalendars.set(calendars);
      });

    this.destroyRef.onDestroy(
      this.renderer.listen(
        this.document,
        'keypress',
        this.handleKeyPress.bind(this)
      )
    );

    this.activeRoute.queryParamMap
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        map(paramMap => paramMap.get('d')),
        filter(dateString => {
          if (dateString) {
            return true;
          }

          this.router.navigate([], {
            queryParams: {
              d: toDateString(new Date()),
            },
            queryParamsHandling: 'merge',
          });

          return false;
        })
      )
      .subscribe(date => {
        this.currentDate.set(new Date(date));
      });
  }

  protected handleHeaderSwipe(evt: SwipeEvent) {
    const calendars = this.displayedCalendars();
    if (calendars.length > 1) {
      return
    }

    let offset = 0
    switch (evt.directionX) {
      case 'left':
        offset = 1
        break;

      case 'right':
        offset = -1
        break
    }

    const all = this.allCalendars();
    const idx = all.findIndex(c => c.id === calendars[0])

    if (idx < 0) {
      this.resetDisplayedCalendars()
    } else {
      let nextIndex = (idx + offset);
      if (nextIndex >= all.length) {
        nextIndex = 0
      }

      if (nextIndex < 0) {
        nextIndex = all.length - 1
      }

      const next = all[nextIndex]

      this.displayedCalendars.set([next.id]);
    }
  }

  protected handleCalendarSwipe(evt: SwipeEvent) {
    const date = this.currentDate();

    switch (evt.directionX) {
      case 'left':
        this.currentDate.set(addDays(date, 1))
        break;

      case 'right':
        this.currentDate.set(addDays(date, -1))
        break
    }
  }

  protected handleShiftClick(shift: PlannedShift) {
    const profiles = this.profiles();

    const cals = shift.assignedUserIds
      .map(user => profiles.find(u => u.user.id === user))
      .map(profile => getCalendarId(profile))
      .filter(cal => !!cal)

    this.displayedCalendars.set(cals)
  }

  ngOnDestroy(): void {
    this.navService.forceHide.set(false);
  }
}
