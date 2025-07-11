import { CommonModule, DatePipe } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  DestroyRef,
  effect,
  HostListener,
  inject,
  Injector,
  LOCALE_ID,
  model,
  OnDestroy,
  OnInit,
  runInInjectionContext,
  signal,
  untracked,
  ViewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { PlainMessage, Timestamp } from '@bufbuild/protobuf';
import { ConnectError } from '@connectrpc/connect';
import {
  lucideClock,
  lucideCog,
  lucideStar,
  lucideZoomIn,
  lucideZoomOut,
} from '@ng-icons/lucide';
import { BrnPopoverModule } from '@spartan-ng/ui-popover-brain';
import { BrnSelectModule } from '@spartan-ng/ui-select-brain';
import { BrnSheetModule } from '@spartan-ng/ui-sheet-brain';
import { injectUserProfiles } from '@tierklinik-dobersberg/angular/behaviors';
import { HlmButtonModule } from '@tierklinik-dobersberg/angular/button';
import { HlmCheckboxComponent } from '@tierklinik-dobersberg/angular/checkbox';
import {
  injectCalendarService,
  injectRosterService,
} from '@tierklinik-dobersberg/angular/connect';
import { HlmDialogService } from '@tierklinik-dobersberg/angular/dialog';
import {
  HlmIconModule,
  provideIcons,
} from '@tierklinik-dobersberg/angular/icon';
import { HlmLabelDirective } from '@tierklinik-dobersberg/angular/label';
import { LayoutService } from '@tierklinik-dobersberg/angular/layout';
import { DurationPipe, ToDatePipe } from '@tierklinik-dobersberg/angular/pipes';
import { HlmPopoverModule } from '@tierklinik-dobersberg/angular/popover';
import { HlmSelectModule } from '@tierklinik-dobersberg/angular/select';
import { HlmSheetModule } from '@tierklinik-dobersberg/angular/sheet';
import { HlmTabsModule } from '@tierklinik-dobersberg/angular/tabs';
import {
  CalendarChangeEvent,
  CalendarEvent,
  MoveEventResponse,
  Calendar as PbCalendar,
} from '@tierklinik-dobersberg/apis/calendar/v1';
import {
  PlannedShift,
  RosterType,
} from '@tierklinik-dobersberg/apis/roster/v1';
import {
  addDays,
  addSeconds,
  getMinutes,
  isSameDay,
  setMinutes,
  setSeconds,
} from 'date-fns';
import { toast } from 'ngx-sonner';
import { debounceTime, interval, map, merge, take } from 'rxjs';
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
  TkdDayViewComponent,
} from '../day-view';
import { StyledTimed } from '../day-view/event-style.pipe';
import { getSeconds } from '../day-view/sort.pipe';
import { SearchEventsDialogComponent } from '../search-events-dialog/search-events-dialog.component';
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
  host: {
    '[attr.tabindex]': "'0'",
    '[autofocus]': "'true'",
  },
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
export class TkdCalendarViewComponent
  implements OnInit, OnDestroy, AfterViewInit
{
  private readonly calendarAPI = injectCalendarService();
  private readonly rosterAPI = injectRosterService();
  private readonly activeRoute = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly dialog = inject(HlmDialogService);
  private readonly header = inject(HeaderTitleService);
  protected readonly cdr = inject(ChangeDetectorRef);

  // Used by the template

  protected readonly navService = inject(NavigationService);

  protected readonly layout = inject(LayoutService);

  protected readonly scrollTop = model<number>();

  /** The currently selected date */
  protected readonly currentDate = toSignal(
    this.activeRoute.queryParamMap.pipe(
      takeUntilDestroyed(this.destroyRef),
      map(paramMap => paramMap.get('d')),
      map(dateString => {
        if (dateString) {
          return new Date(dateString);
        }

        return new Date();
      })
    )
  );

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

  protected viewService = signal(
    new CalendarViewService(
      this.currentDate(),
      this.allCalendars,
      this.rosterTypes,
      this.profiles
    )
  );

  protected viewState = computed(() => {
    const service = this.viewService();

    if (!service) {
      return null;
    }

    return service.viewState();
  });

  protected nextService = signal<CalendarViewService | null>(null);
  protected prevService = signal<CalendarViewService | null>(null);

  /** A reference to the day-view component */
  @ViewChild(TkdDayViewComponent, { static: false })
  dayViewComponent!: TkdDayViewComponent<CalEvent>;

  /** Callback handler for adjusting the size-factor using '+' and '-' keys */
  @HostListener('keydown', ['$event'])
  public handleKeyPress(event: KeyboardEvent) {
    if (event.key === '+') {
      this.dayViewComponent?.zoomIn();
    }

    if (event.key === '-') {
      this.dayViewComponent?.zoomOut();
    }

    if (event.key === 'ArrowLeft') {
      this.setDate(addDays(this.currentDate(), -1));
    }

    if (event.key === 'ArrowRight') {
      this.setDate(addDays(this.currentDate(), 1));
    }
  }

  /** A callback for the day-view component to handle calendar-event resize events */
  protected handleResize(e: { event: StyledTimed; duration: number }) {
    this.skipLoading = true;

    let oldDuration = getSeconds(e.event.duration);

    let duration = Math.round(e.duration / (15 * 60)) * 15 * 60;

    // apply min-duration
    if (duration < 15 * 60) {
      duration = 15 * 60;
    }

    this.viewService().updateEventDuration(
      e.event.calendarId,
      e.event.id,
      duration
    );

    this.calendarAPI
      .updateEvent({
        calendarId: e.event.calendarId,
        eventId: e.event.id as any,
        end: Timestamp.fromDate(addSeconds(coerceDate(e.event.from), duration)),
        updateMask: {
          paths: ['end'],
        },
      })
      .catch(err => {
        this.viewService().updateEventDuration(
          e.event.calendarId,
          e.event.id,
          oldDuration
        );

        toast.error('Termin konnte nicht gespeichert werden', {
          description: ConnectError.from(err).message,
        });
      });
  }

  /** A callback function for the day-view component to handle calendar-event moves */
  protected handleEventMoved(evt: EventMovedEvent<CalEvent>) {
    this.skipLoading = true;

    const duration = Number(
      evt.event.endTime?.seconds - evt.event.startTime.seconds
    );

    if (duration < 0 || isNaN(duration)) {
      return;
    }

    // clip to 15 minutes slots
    let date = setSeconds(evt.date, 0);
    date = setMinutes(date, Math.round(getMinutes(date) / 15) * 15);

    let endDate = addSeconds(
      date,
      Math.round((duration / (15 * 60)) * 15 * 60)
    );

    const original = this.viewService().findEvent(
      evt.event.calendarId,
      evt.event.id
    );
    if (!original) {
      return;
    }

    const updated = original.clone();
    updated.startTime = Timestamp.fromDate(date);
    updated.endTime = Timestamp.fromDate(endDate);
    updated.calendarId = evt.calendarId;

    this.viewService().moveEvent(original, updated);

    this.calendarAPI
      .updateEvent({
        calendarId: evt.event.calendarId,
        eventId: evt.event.id,
        start: updated.startTime,
        end: updated.endTime,
        updateMask: {
          paths: ['start', 'end'],
        },
      })
      .then(upd => {
        // check if we need to move the event to a different calendar as well
        if (evt.calendarId !== evt.event.calendarId) {
          return this.calendarAPI
            .moveEvent({
              eventId: upd.event!.id,
              source: {
                case: 'sourceCalendarId',
                value: upd.event!.calendarId,
              },
              target: {
                case: 'targetCalendarId',
                value: updated.calendarId,
              },
            })
            .then(res => {
              // Delete the fake event and replace it with the actual one (which might have a new ID)
              this.viewService().deleteEvent(updated.calendarId, updated.id);
              this.viewService().push(res.event);

              return res;
            })
            .catch(err => {
              this.viewService().deleteEvent(updated.calendarId, updated.id);
              this.viewService().push(original);
              throw err;
            });
        }

        return new MoveEventResponse();
      })
      .catch(err => {
        this.viewService().moveEvent(updated, original);

        toast.error('Termin konnte nicht gespeichert werden', {
          description: ConnectError.from(err).message,
        });
      });
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

      /*
      CreateEventSheetComponent.open(this.dialog, {
        calendarId: event.calendar.id,
        dateTime: date,
      })
      return
      */
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
      .closed$.pipe(take(1))
      .subscribe(result => {
        if (!result) {
          return;
        }

        if (result instanceof CalendarEvent) {
          this.viewService().deleteEvent(result.calendarId, result.id);
          this.viewService().push(result);
        } else if (result.type === 'deleted') {
          this.viewService().deleteEvent(result.calendarId, result.eventId);
        } else {
          this.viewService().moveEvent(result.original, result.updated);
        }
      });
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
    const injector = inject(Injector);

    effect(
      () => {
        const current = this.viewService();
        if (!current) {
          return;
        }

        let next: CalendarViewService;
        let prev: CalendarViewService;
        runInInjectionContext(injector, () => {
          next = new CalendarViewService(
            addDays(current.date, 1),
            this.allCalendars,
            this.rosterTypes,
            this.profiles
          );

          prev = new CalendarViewService(
            addDays(current.date, -1),
            this.allCalendars,
            this.rosterTypes,
            this.profiles
          );
        });

        this.nextService.set(next);
        this.prevService.set(prev);
      },
      { allowSignalWrites: true }
    );

    effect(
      () => {
        const date = this.currentDate();

        // if we're just switching to the next or prev date we might just need
        // to replace the service with the existing nextService or prevService
        // respectively.
        let next = untracked(() => this.nextService());
        let prev = untracked(() => this.prevService());
        let toReplace: CalendarViewService | null = null;
        let dir = 'abort';

        if (isSameDay(next?.date, date)) {
          toReplace = next;
          dir = 'left';
        } else if (isSameDay(prev?.date, date)) {
          toReplace = prev;
          dir = 'right';
        }

        if (toReplace) {
          this.startPanning();
          requestAnimationFrame(() => {
            this.stopPanning(dir as any, () => {
              this.viewService.set(toReplace);
            });
          });
          return;
        }

        runInInjectionContext(injector, () => {
          this.viewService.set(
            new CalendarViewService(
              date,
              this.allCalendars,
              this.rosterTypes,
              this.profiles
            )
          );
        });
      },
      { allowSignalWrites: true }
    );

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

    merge(
      inject(EventService)
        .subscribe(new CalendarChangeEvent()),
      interval(10000),
    )
      .pipe(
        takeUntilDestroyed(),
        debounceTime(1000)
      )
      .subscribe(() => {
        if (this.skipLoading) {
          return;
        }

        this.viewService()?.reload();
        this.nextService()?.reload();
        this.prevService()?.reload();
      });

    effect(() => {
      const date = this.currentDate();

      if (!date) {
        return;
      }

      this.header.set(
        'Kalender',
        'Termine am ' + datePipe.transform(date, 'fullDate')
      );
    });

    let lastService: CalendarViewService | null = null;
    effect(
      () => {
        const current = this.viewService();
        const loading = current.loading();
        if (loading || current === lastService) {
          return;
        }

        this.resetDisplayedCalendars();

        /*
        if (this.viewInitialized) {
          this.dayViewComponent.doAutoScroll();
        } else {
          setTimeout(() => {
            requestAnimationFrame(() => {
              this.dayViewComponent.doAutoScroll();
            });
          }, 500);
        }
        */

        lastService = current;
      },
      { allowSignalWrites: true }
    );
  }

  protected handleCalendarHeaderClick(cal: Calendar) {
    const display = this.displayedCalendars();
    if (display.length === 1 && display[0] === cal.id) {
      this.resetDisplayedCalendars();
    } else {
      this.displayedCalendars.set([cal.id]);
    }
  }

  protected resetDisplayedCalendars() {
    this.displayedCalendars.set(this.viewState().defaultDisplayCalendars);
  }

  ngOnInit(): void {
    this.rosterAPI.listRosterTypes({}).then(response => {
      this.rosterTypes.set(response.rosterTypes);
    });

    this.calendarAPI
      .listCalendars({ includeVirtualResourceCalendars: true })
      .then(response => {
        const calendars = response.calendars.sort((a, b) =>
          a.id.localeCompare(b.id)
        );

        this.allCalendars.set(calendars);
      });

    /*
    this.destroyRef.onDestroy(
      this.renderer.listen(
        this.document,
        'keydown',
        this.handleKeyPress.bind(this)
      )
    );
    */
  }

  protected readonly translateX = signal('0%');
  protected readonly dayViewClass = signal('');
  protected readonly panActive = signal(false);

  protected handlePanStart(event: HammerInput) {}

  private lastPanDeltaX = 0;

  protected handlePanMove(event: HammerInput) {
    if (this.layout.md()) {
      return;
    }

    var clientX: number | null = null;

    if (event.srcEvent instanceof MouseEvent) {
      clientX = event.srcEvent.clientX;
    } else if (
      event.srcEvent instanceof TouchEvent &&
      event.srcEvent.touches.length === 1
    ) {
      clientX = event.srcEvent.touches[0].clientX;
    } else if (event.srcEvent instanceof PointerEvent) {
      clientX = event.srcEvent.clientX;
    }

    if (clientX === null) {
      return;
    }

    let y: 'top' | 'bottom' | '' =
      Math.abs(event.deltaY) > 80 ? (event.deltaY > 0 ? 'bottom' : 'top') : '';

    if (
      y !== '' &&
      this.panActive() &&
      Math.abs(event.deltaY) >= Math.abs(event.deltaX)
    ) {
      console.log('aborting pan due to vertical movement');
      this.panActive.set(false);
      this.dayViewClass.set('');
      this.translateX.set('0%');
      return;
    }

    if (!this.panActive()) {
      if (
        (Math.abs(event.deltaX) < 20 &&
          clientX < window.innerWidth * 0.7 &&
          clientX > window.innerHeight * 0.3) ||
        Math.abs(event.deltaX) < 5 ||
        y !== ''
      ) {
        return;
      }

      this.startPanning();
      this.lastPanDeltaX = event.deltaX;
    } else {
      this.translateX.set('calc(-100% + ' + event.deltaX + 'px)');

      if (Math.abs(this.lastPanDeltaX) < Math.abs(event.deltaX)) {
        this.lastPanDeltaX = event.deltaX;
      }
    }
  }

  protected searchEvents() {
    SearchEventsDialogComponent.open(this.dialog);
  }

  private startPanning() {
    this.translateX.set('-100%');
    this.panActive.set(true);
  }

  protected handlePanStop(evt: HammerInput) {
    if (!this.panActive()) {
      return;
    }

    let x: 'right' | 'left' | 'abort' =
      Math.abs(evt.deltaX) > 80 ? (evt.deltaX > 0 ? 'right' : 'left') : 'abort';

    let newDate: Date;
    if (
      Math.abs(evt.deltaX) < 80 ||
      Math.abs(evt.deltaX) < Math.abs(this.lastPanDeltaX)
    ) {
      x = 'abort';
    } else {
      const date = this.currentDate();

      switch (x) {
        case 'left':
          newDate = addDays(date, 1);
          break;

        case 'right':
          newDate = addDays(date, -1);
          break;
      }
    }

    this.stopPanning(x, newDate);
  }

  private stopPanning(
    direction: 'left' | 'right' | 'abort',
    newDate?: Date | (() => void)
  ) {
    this.dayViewClass.set('transition-transform duration-500');
    this.lastPanDeltaX = 0;

    switch (direction) {
      case 'left':
        this.translateX.set('-200%');
        break;

      case 'right':
        this.translateX.set('0%');
        break;

      case 'abort':
        this.translateX.set('-100%');
        break;
    }

    setTimeout(() => {
      if (newDate) {
        if (newDate instanceof Date) {
          this.setDate(newDate);
        } else {
          newDate();
        }
      }
      this.dayViewClass.set('');
      this.translateX.set('0%');
      this.panActive.set(false);
    }, 500);
  }

  protected handleCalendarSwipe(evt: HammerInput) {
    if (Math.abs(evt.deltaX) < 100) {
      return;
    }

    const x =
      Math.abs(evt.deltaX) > 80 ? (evt.deltaX > 0 ? 'right' : 'left') : '';
    const y = Math.abs(evt.deltaY) > 80 ? (evt.deltaY > 0 ? 'down' : 'up') : '';

    const date = this.currentDate();

    switch (x) {
      case 'left':
        this.setDate(addDays(date, 1));
        break;

      case 'right':
        this.setDate(addDays(date, -1));
        break;
    }
  }

  protected handleShiftClick(shift: PlannedShift) {
    const profiles = this.profiles();

    const cals = shift.assignedUserIds
      .map(user => profiles.find(u => u.user.id === user))
      .map(profile => getCalendarId(profile))
      .filter(cal => !!cal);

    this.displayedCalendars.set(cals);
  }

  ngOnDestroy(): void {
    this.navService.forceHide.set(false);
  }

  private viewInitialized = false;
  ngAfterViewInit(): void {
    this.viewInitialized = true;
  }
}
