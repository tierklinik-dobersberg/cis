import { CommonModule, DatePipe, DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  Injector,
  LOCALE_ID,
  model,
  OnDestroy,
  OnInit,
  Renderer2,
  runInInjectionContext,
  signal,
  untracked,
  ViewChild
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { PlainMessage, Timestamp } from '@bufbuild/protobuf';
import { ConnectError } from '@connectrpc/connect';
import { lucideClock, lucideCog, lucideStar, lucideZoomIn, lucideZoomOut } from '@ng-icons/lucide';
import { BrnPopoverModule } from '@spartan-ng/ui-popover-brain';
import { BrnSelectModule } from '@spartan-ng/ui-select-brain';
import { BrnSheetModule } from '@spartan-ng/ui-sheet-brain';
import {
  injectUserProfiles
} from '@tierklinik-dobersberg/angular/behaviors';
import { HlmButtonModule } from '@tierklinik-dobersberg/angular/button';
import { HlmCheckboxComponent } from '@tierklinik-dobersberg/angular/checkbox';
import {
  injectCalendarService,
  injectRosterService
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
import { HlmPopoverModule } from '@tierklinik-dobersberg/angular/popover';
import { HlmSelectModule } from '@tierklinik-dobersberg/angular/select';
import { HlmSheetModule } from '@tierklinik-dobersberg/angular/sheet';
import { HlmTabsModule } from '@tierklinik-dobersberg/angular/tabs';
import {
  CalendarChangeEvent,
  CalendarEvent,
  ListEventsResponse,
  MoveEventResponse,
  Calendar as PbCalendar
} from '@tierklinik-dobersberg/apis/calendar/v1';
import {
  PlannedShift,
  RosterType
} from '@tierklinik-dobersberg/apis/roster/v1';
import {
  addDays,
  addSeconds,
  getMinutes,
  isSameDay,
  setMinutes,
  setSeconds
} from 'date-fns';
import { toast } from 'ngx-sonner';
import { debounceTime, map } from 'rxjs';
import {
  TkdDatePickerComponent,
  TkdDatePickerInputDirective,
} from 'src/app/components/date-picker';
import { TkdDatePickerTriggerComponent } from 'src/app/components/date-picker/picker-trigger';
import { AppPopoverTriggerDirective } from 'src/app/components/triggers';
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
  coerceDate,
  DEFAULT_HOUR_HEIGHT_PX,
  EventMovedEvent,
  Timed,
  TkdCalendarEventCellTemplateDirective,
  TkdCalendarHeaderCellTemplateDirective,
  TkdDayViewComponent
} from '../day-view';
import { StyledTimed } from '../day-view/event-style.pipe';
import { CalendarViewService } from './calendar-view.service';

export type CalEvent = Timed &
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
    HlmSheetModule,
    BrnSheetModule,
    BrnPopoverModule,
    HlmPopoverModule,
    AppPopoverTriggerDirective,
  ],
  providers: [
    ...provideIcons({
      lucideZoomIn,
      lucideZoomOut,
      lucideStar,
      lucideCog,
      lucideClock,
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

      @container (max-height: 4rem) {
        .event-details {
          @apply py-0;
          font-size: 75%;
        }
      }

      @container (max-width: 60px) {
        .event-start-time {
          display: none;
        }
      }

      .event-details {
          @apply flex flex-col flex-nowrap;
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
  private readonly calendarAPI = injectCalendarService();
  private readonly rosterAPI = injectRosterService();
  private readonly activeRoute = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly renderer = inject(Renderer2);
  private readonly document = inject(DOCUMENT);
  private readonly dialog = inject(HlmDialogService);
  private readonly header = inject(HeaderTitleService);
  protected readonly cdr = inject(ChangeDetectorRef)

  // Used by the template

  protected readonly navService = inject(NavigationService);

  protected readonly layout = inject(LayoutService);

  /** The currently selected date */
  protected readonly currentDate = toSignal(
    this.activeRoute.queryParamMap
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        map(paramMap => paramMap.get('d')),
        map(dateString => {
          if (dateString) {
            return new Date(dateString)
          }

          return new Date()
        })
      )
  )

  /** A list of available calendars */
  protected readonly allCalendars = signal<PbCalendar[]>([]);

  /** The current "size" factor */
  protected readonly sizeFactor = storedSignal(
    'cis:calendar:sizeFactor',
    DEFAULT_HOUR_HEIGHT_PX / 60 / 60
  );

  /** The user profiles */
  protected readonly profiles = injectUserProfiles();

  /** A list of calendar ids to display */
  protected readonly displayedCalendars = model<string[]>([]);

  /** Whether or not CalendarEventChanged events should trigger a reload or not */
  protected skipLoading = false;

  /** The roster-types to considere for working-staff and shifts */
  protected readonly rosterTypes = signal<null | RosterType[]>([]);

  /**
   * The current state of loading data. Once all types are loaded (i.e. loading.length == 3), the calendars to display
   * can be calculated.
   */
  protected readonly loading = signal<('types' | 'shifts' | 'events')[]>([]);

  /** A dummy variable to type-safety in the template */
  protected readonly calendarType: Calendar = null;

  protected viewService = signal(new CalendarViewService(
    this.currentDate(),
    this.allCalendars,
    this.rosterTypes,
    this.profiles
  ))

  protected viewState = computed(() => {
    const service = this.viewService()

    if (!service) {
      return null
    }

    return service.viewState()
  })

  protected nextService = signal<CalendarViewService | null>(null)
  protected prevService = signal<CalendarViewService | null>(null)

  /** A reference to the day-view component */
  @ViewChild(TkdDayViewComponent, { static: true })
  dayViewComponent!: TkdDayViewComponent<CalEvent>;

  /** Callback handler for adjusting the size-factor using '+' and '-' keys */
  private handleKeyPress(event: KeyboardEvent) {
    if (event.key === '+') {
      this.dayViewComponent?.zoomIn();
    }

    if (event.key === '-') {
      this.dayViewComponent?.zoomOut();
    }
  }

  /** A callback for the day-view component to handle calendar-event resize events */
  protected handleResize(e: {event: StyledTimed, duration: number}) {
    this.skipLoading = true;

    let duration = Math.round(e.duration / (15*60)) *15*60

    // apply min-duration
    if (duration < 15 * 60) {
      duration = 15*60;
    }

    // update the event style now to immediately reflect the changes
    e.event.style.height = (this.dayViewComponent.sizeFactor() * duration) + 'px';
    e.event.style = {...e.event.style};

    this.calendarAPI
      .updateEvent({
        calendarId:e.event.calendarId, 
        eventId: e.event.id as any,
        end: Timestamp.fromDate( addSeconds(coerceDate(e.event.from), duration) ), 
        updateMask: {
          paths: ['end']
        }
      })
      .catch( err => {
        toast.error('Termin konnte nicht gespeichert werden', {
          description: ConnectError.from(err).message
        })
      })
  }

  
  /** A callback function for the day-view component to handle calendar-event moves */
  protected handleEventMoved(evt: EventMovedEvent<CalEvent>) {
    this.skipLoading = true;

    const duration = Number(evt.event.endTime?.seconds - evt.event.startTime.seconds);

    if (duration < 0 || isNaN(duration))  {
      return
    }

    const copy = new CalendarEvent({
      ...evt.event,
      startTime: Timestamp.fromDate(evt.date),
      calendarId: evt.calendarId,
      endTime: Timestamp.fromDate( addSeconds(evt.date, duration)),
      id: evt.event.id + '-moved'
    })

    const res = this.viewService().eventListResponse()
    const sourceCalendar = res.results.find(c => c.calendar.id === evt.event.calendarId)
    const sourceIndex = sourceCalendar.events.findIndex(e => e.id === evt.event.id);

    if (evt.calendarId !== evt.event.calendarId) {
      const targetCalendar = res.results.find(c => c.calendar.id === evt.calendarId);
      sourceCalendar.events.splice(sourceIndex, 1)
      targetCalendar.events.push(copy);
    } else {
      sourceCalendar.events[sourceIndex] = copy  
    }

    this.viewService().eventListResponse.set(new ListEventsResponse({
      ...res,
    }))

    this.calendarAPI
      .updateEvent({
        calendarId: evt.event.calendarId,
        eventId: evt.event.id,
        start: copy.startTime,
        end: copy.endTime,
        updateMask: {
          paths: ['start', 'end']
        }
      })
      .then(() => {
        // check if we need to move the event to a different calendar as well
        if (evt.calendarId !== evt.event.calendarId) {
          return this.calendarAPI
            .moveEvent({
              eventId: evt.event.id,
              source: {
                case: 'sourceCalendarId',
                value: evt.event.calendarId
              },
              target: {
                case: 'targetCalendarId',
                value: evt.calendarId,
              }
            })
        }

        return Promise.resolve(new MoveEventResponse)
      })
      .catch(err => {
        toast.error('Termin konnte nicht gespeichert werden', {
          description: ConnectError.from(err).message
        })
      })
  }

  /** A callback function for the day-view component to handle event and calendar clicks */
  protected handleCalendarClick(event: CalendarMouseEvent<CalEvent, Calendar>) {
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
  }

  /** A utility method used by the template to quickly switch the current date to today */
  protected loadToday() {
    this.setDate(new Date());
  }

  /** A utility method used by the temlate to toggle whether or not a given calendar is displayd */
  protected toggleUser(calendarID: string) {
    const calendars = this.displayedCalendars();
    if (calendars.includes(calendarID)) {
      this.displayedCalendars.set(calendars.filter(c => c != calendarID));
    } else {
      this.displayedCalendars.set([...calendars, calendarID]);
    }
  }

  /** A utility method to switch the current calendar date by updating the current component URL */
  protected setDate(date: Date) {
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
    const injector = inject(Injector)

    effect(() => {
      const current = this.viewService();
      if (!current) {
        return
      }

      let next: CalendarViewService;
      let prev: CalendarViewService;
      runInInjectionContext(injector, () => {
        next = new CalendarViewService(
          addDays(current.date, 1),
          this.allCalendars,
          this.rosterTypes,
          this.profiles
        )

        prev = new CalendarViewService(
          addDays(current.date, -1),
          this.allCalendars,
          this.rosterTypes,
          this.profiles
        )
      })

      this.nextService.set(next);
      this.prevService.set(prev);
    }, { allowSignalWrites: true })

    effect(() => {
      const date = this.currentDate();

      // if we're just switching to the next or prev date we might just need
      // to replace the service with the existing nextService or prevService
      // respectively.
      let next = untracked(() => this.nextService())
      let prev = untracked(() => this.prevService())
      if (isSameDay(next?.date, date)) {
        this.viewService.set(next)
        return
      }

      if (isSameDay(prev?.date, date)) {
        this.viewService.set(prev)
        return
      }

      runInInjectionContext(injector, () => {
        this.viewService.set(new CalendarViewService(
          date,
          this.allCalendars,
          this.rosterTypes,
          this.profiles
        ))
      })
    }, {allowSignalWrites: true})

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
      .subscribe(() => {
        if (this.skipLoading) {
          return
        }

        console.log("loading events due to events event")
        this.viewService()?.reload()
        this.nextService()?.reload()
        this.prevService()?.reload()
      });

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
    })

    let lastService: CalendarViewService | null = null;
    effect(
      () => {
        const current = this.viewService();
        const loading = current.loading();
        if (loading || current === lastService) {
          return
        }

        this.resetDisplayedCalendars()
        lastService = current;
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
    console.log("resetting displayed calendars")

    const events = this.viewService().viewState().events;
    const set = new Set<string>();

    events.forEach(evt => {
      set.add(evt.calendarId);
    });

    const values = Array.from(set.values());
    this.displayedCalendars.set(values);
  }

  ngOnInit(): void {
    this.rosterAPI
      .listRosterTypes({})
      .then(response => {
        this.rosterTypes.set(response.rosterTypes)
      })

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

  }

  protected handleCalendarSwipe(evt: HammerInput) {
    if (Math.abs(evt.deltaX) < 300) {
      return;
    }

    const x =
      Math.abs(evt.deltaX) > 80 ? (evt.deltaX > 0 ? 'right' : 'left') : '';
    const y = Math.abs(evt.deltaY) > 80 ? (evt.deltaY > 0 ? 'down' : 'up') : '';

    const date = this.currentDate();

    switch (x) {
      case 'left':
        this.setDate(addDays(date, 1))
        break;

      case 'right':
        this.setDate(addDays(date, -1))
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
