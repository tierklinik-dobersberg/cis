import { CommonModule, DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnDestroy,
  OnInit,
  Renderer2,
  ViewChild,
  computed,
  effect,
  inject,
  model,
  signal,
  untracked
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { PlainMessage, Timestamp } from '@bufbuild/protobuf';
import {
  lucideZoomIn,
  lucideZoomOut
} from '@ng-icons/lucide';
import { BrnSelectModule } from '@spartan-ng/ui-select-brain';
import { injectUserProfiles } from '@tierklinik-dobersberg/angular/behaviors';
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
  ToDatePipe
} from '@tierklinik-dobersberg/angular/pipes';
import { HlmSelectModule } from '@tierklinik-dobersberg/angular/select';
import { CalendarChangeEvent, CalendarEvent, ListEventsResponse, Calendar as PbCalendar } from '@tierklinik-dobersberg/apis/calendar/v1';
import { Profile } from '@tierklinik-dobersberg/apis/idm/v1';
import { PlannedShift, WorkShift } from '@tierklinik-dobersberg/apis/roster/v1';
import {
  differenceInSeconds,
  endOfDay,
  getMinutes,
  isAfter,
  isBefore,
  isSameDay,
  setMinutes,
  setSeconds,
  startOfDay
} from 'date-fns';
import {
  debounceTime,
  filter,
  map
} from 'rxjs';
import { TkdDatePickerComponent, TkdDatePickerInputDirective } from 'src/app/components/date-picker';
import { TkdDatePickerTriggerComponent } from 'src/app/components/date-picker/picker-trigger';
import { UserColorVarsDirective } from 'src/app/components/user-color-vars';
import { HeaderTitleService } from 'src/app/layout/header-title';
import { NavigationService } from 'src/app/layout/navigation/navigation.service';
import { ByCalendarIdPipe } from 'src/app/pipes/by-calendar-id.pipe';
import { ToRGBAPipe } from 'src/app/pipes/to-rgba.pipe';
import { getCalendarId } from 'src/app/services';
import { EventService } from 'src/app/services/event.service';
import { toDateString } from 'src/app/utils';
import { AppEventDetailsDialogComponent } from '../../../dialogs/event-details-dialog';
import {
  Calendar,
  CalendarMouseEvent,
  Timed,
  TkdCalendarEventCellTemplateDirective,
  TkdCalendarHeaderCellTemplateDirective,
  TkdDayViewComponent
} from '../day-view';
import { getSeconds } from '../day-view/sort.pipe';

type CalEvent = Timed &
  PlainMessage<CalendarEvent> & {
    isShiftType?: boolean;
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
  ],
  providers: [
    ...provideIcons({
      lucideZoomIn,
      lucideZoomOut,
    }),
  ],
  styles: [
    `
      :host {
        @apply flex h-full flex-col pb-8 xl:flex-row gap-2 xl:!p-0;
      }
      .event-container {
        container-type: size;
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
  private readonly header = inject(HeaderTitleService)

  protected readonly navService = inject(NavigationService)
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

  protected readonly calendars = computed(() => {
    const profiles = this.profiles();
    const calendars = this.allCalendars();
    const displayed = new Set(this.displayedCalendars());
    const shifts = this.shifts();

    const profileLookupMap = new Map<string, Profile>();
    profiles.forEach(p => {
      const calId = getCalendarId(p)
      if (calId) {
        profileLookupMap.set(calId, p)
      }
    })

    const workingStaff = new Set<string>();
    shifts.forEach(shift => shift.assignedUserIds.forEach(user => workingStaff.add(user)))

    return calendars
      .filter(cal => {
        if (displayed.has(cal.id)) {
          return true
        }

        const profile = profileLookupMap.get(cal.id)
        if (!profile) {
          return true
        }

        // display the user even if it has been deleted
        // if it was still assigned to a working shift on the current date.
        if (workingStaff.has(profile.user.id)) {
          return true
        }

        return !profile.user.deleted
      })
      .sort((a, b) => {
        let ap = profileLookupMap.get(a.id);
        let bp = profileLookupMap.get(b.id);

        if (ap && ap.user.deleted) {
          ap = null
        }

        if (bp && bp.user.deleted) {
          bp = null
        }

        let av = ap ? (workingStaff.has(ap.user.id) ? 2 : 1) : -1;
        let bv = bp ? (workingStaff.has(bp.user.id) ? 2 : 1) : -1;

        return bv - av;
      })
  })

  /** The user profiles */
  protected readonly profiles = injectUserProfiles();

  /** A list of calendar ids to display */
  protected readonly displayedCalendars = model<string[]>([]);

  /** The list of events */
  protected readonly events = signal<CalEvent[]>([]);

  protected readonly shifts = signal<PlannedShift[]>([]);
  protected readonly shiftDefinitions = signal<WorkShift[]>([]);

  protected readonly _computedShiftEvents = computed(() => {
    const shifts = this.shifts();
    const profiles = this.profiles();
    const date = startOfDay(this.currentDate());

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
        fromDate = date
        from = 0;
      }

      if (isAfter(toDate, endOfDay(date))) {
        toDate = endOfDay(date)
      }

      let duration = differenceInSeconds(toDate, fromDate)

      shift.assignedUserIds
        .map(id => profileById.get(id))
        .filter(profile => !!profile)
        .forEach(profile => {
          const calendarId = getCalendarId(profile);
          if (!calendarId) {
            return;
          }

          shiftEvents.push({
            calendarId: calendarId,
            summary: lm.get(shift.workShiftId)?.name || 'unknown',
            from: from,
            duration: duration,
            fullDay: false,
            isFree: false,
            id:
              'shift:' +
              profile.user.id +
              ':' +
              shift.workShiftId +
              ':' +
              shift.from.toDate().toISOString() +
              '-' +
              shift.to.toDate().toISOString()
              + '-' + definitions.find(w => w.id === shift.workShiftId).tags.join(':'),
            description: '',
            ignoreOverlapping: true,
            isShiftType: true,
          });
        });
    });


    return shiftEvents;
  });

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
    const contentClass =
      'w-screen overflow-auto max-w-[unset] sm:w-[750px] md:w-[750px] h-[100dvh] sm:h-[unset] ';

    let ctx: any = {
      calendar: event.calendar,
    };

    if (event.doubleClick) {
      // clear out the seconds and round mintues to the nearest multiple of 15
      let date = setSeconds(event.date, 0);
      date = setMinutes(date, Math.round(getMinutes(date) / 15) * 15);

      ctx.startTime = date;
    } else if (event.clickedEvent && !event.clickedEvent.isShiftType) {
      ctx.event = event.clickedEvent;
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
      this.displayedCalendars.set(calendars.filter(c => c != user))
    } else {
      this.displayedCalendars.set([...calendars, user])
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
    if (window.localStorage && typeof(window.localStorage.getItem) === 'function') {
      const shouldHide = window.localStorage.getItem("cis:calendar:hideMenu")

      this.navService.forceHide.set(shouldHide === null ? this.layout.xxl() : (shouldHide === 'true'));

      effect(() => {
        const forceHide = this.navService.forceHide();

        if (forceHide) {
          window.localStorage.setItem('cis:calendar:hideMenu', 'true')
        } else {
          window.localStorage.setItem('cis:calendar:hideMenu', 'false')
        }
      })
    } else {
      this.navService.forceHide.set(true)
    }

    inject(EventService)
      .subscribe(new CalendarChangeEvent)
      .pipe(takeUntilDestroyed(), debounceTime(1000))
      .subscribe(() => this.loadEvents(this.currentDate()))

    let loading = 0;
    effect(() => {
      const date = this.currentDate();

      if (!date) {
        return;
      }

      this.header.set(
        'Kalender',
        'Termine am ' + toDateString(date),
      )

      loading = 0;

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
        });

      this.loadEvents(date);
    }, {
      allowSignalWrites: true
    });

    effect(() => {
      const events = this._computedEvents();

      if (loading <= 2) {
        loading++;

        let set = new Set<string>();
        events.forEach(evt => {
          set.add(evt.calendarId);
        });

        this.displayedCalendars.set(Array.from(set.values()));
      }
    }, { allowSignalWrites: true })
  }

  private _lastLoadEventsResponse: ListEventsResponse | null = null;
  private loadEvents(date: Date) {
    const eventsBefore = untracked(() => this.events());
    this.events.set([]);

    this.calendarAPI
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
      .then(response => {
        if (response.equals(this._lastLoadEventsResponse)) {
          console.log("skipping update, nothing changed")
          this.events.set(eventsBefore);

          return
        }

        this._lastLoadEventsResponse = response;

        let events: CalEvent[] = [];
        response.results.forEach(eventList => {
          eventList.events.forEach(evt => {
            events.push({
              ...evt,
              from: evt.startTime,
              duration: getSeconds(evt.endTime) - getSeconds(evt.startTime),
            });
          });
        });
        this.events.set(events);

      });
  }

  ngOnInit(): void {
    this.calendarAPI.listCalendars({}).then(response => {
      const calendars = response.calendars
        .sort((a, b) => a.id.localeCompare(b.id))

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
        filter((dateString) => {
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
      .subscribe((date) => {
        this.currentDate.set(new Date(date));
      });
  }

  ngOnDestroy(): void {
    this.navService.forceHide.set(false);
  }
}
