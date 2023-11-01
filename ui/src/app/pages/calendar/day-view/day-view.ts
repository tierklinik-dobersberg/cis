import { coerceBooleanProperty, coerceCssPixelValue } from '@angular/cdk/coercion';
import { ConnectedPosition, Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, Input, NgZone, OnDestroy, OnInit, QueryList, TemplateRef, TrackByFunction, ViewChild, ViewChildren, ViewContainerRef, inject } from '@angular/core';
import { Timestamp } from '@bufbuild/protobuf';
import { Calendar, CalendarEvent, CalendarEventList, Profile } from '@tkd/apis';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';
import { BehaviorSubject, Subject, combineLatest, forkJoin, from, interval, of } from 'rxjs';
import { catchError, map, startWith, switchMap, take, takeUntil } from 'rxjs/operators';
import { OpeningHoursAPI, OpeningHoursResponse, UserService } from 'src/app/api';
import { CALENDAR_SERVICE, ROSTER_SERVICE } from 'src/app/api/connect_clients';
import { ProfileService, getCalendarId, getUserColor } from 'src/app/services/profile.service';
import { HeaderTitleService } from 'src/app/shared/header-title';
import { extractErrorMessage, getContrastFontColor } from 'src/app/utils';
import { Duration, formatDate } from 'src/utils/duration';

interface DisplayEvent {
  event: CalendarEvent;
  top: number;
  offsettop: number;
  height: number;
  left: number;
  color: string;
  fontColor: string;
  overlapping: number;
}

interface LocalCalendar {
  calendar: Calendar;
  user?: Profile;
  events: DisplayEvent[];
  displayed?: boolean;
  color: string;
  fontColor: string;
}

interface CreateEventData {
  start: string;
  duration: number,
  summary: string,
  description: string,
  user?: Profile;
  calName: string;
  calID: string;
  marker?: ElementRef,
  update: () => void,
  close: () => void,
}

type CalendarMode = 'auto' | 'mine' | 'all' | 'selected';

@Component({
  selector: 'app-calendar-day-view',
  templateUrl: './day-view.html',
  styleUrls: ['./day-view.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DayViewComponent implements OnInit, OnDestroy {
  private rosterService = inject(ROSTER_SERVICE);

  /** emits and completes when the component is destroyed */
  private _destroy$ = new Subject<void>();

  /** The current day */
  private _currentDate$ = new BehaviorSubject<Date>(new Date());

  /** Used to request re-layouting of events. */
  private _layouting$ = new BehaviorSubject<void>(undefined)

  readonly hourHeight = 120;

  /** Reference to the event details overlay */
  private _eventDetailsOverlay: OverlayRef | null = null;

  /** The currently working staff today according to the roster */
  roster: string[] = [];

  /** Whether or not we're still in the initial load */
  loading = true;

  /** Whether or not the _currentDate$ is for today */
  isToday = false;

  /** offset from top for the today bars */
  todayOffset = 0;

  /** The current time */
  currentTime = new Date();

  /** All events for the selected day */
  calendars: LocalCalendar[] = [];

  /** The currently active event id */
  activeEventID: string = '';

  @ViewChild('scrollContainer', { static: true })
  scrollable: ElementRef;

  /** The curent calendar mode */
  calendarMode: CalendarMode = 'auto';

  /** The number of displayed calendars */
  displayedCalendarCount = 0;

  /** Display text for the current calendar mode */
  calendarModeText = {
    'auto': 'Automatisch',
    'mine': 'Mein Kalender',
    'all': 'Alle Kalender',
    'selected': 'Nur ausgewählte',
  };

  openingHours: { y: string, height: string }[] = [];

  @ViewChild('eventDetailsTemplate', { read: TemplateRef, static: true })
  eventDetailsTemplate: TemplateRef<any>;

  @ViewChild('createEventTemplate', { read: TemplateRef, static: true })
  createEventTemplate: TemplateRef<any>;

  @ViewChildren('createEventMarker', { read: ElementRef })
  createEventMarkers!: QueryList<ElementRef>;

  @Input()
  set inlineView(v: any) {
    this._inlineView = coerceBooleanProperty(v)
  }
  get inlineView(): boolean { return this._inlineView }
  private _inlineView = false;

  private positions: ConnectedPosition[] = [
    {
      originX: 'end',
      originY: 'top',
      overlayX: 'start',
      overlayY: 'top',
    },
    {
      originX: 'start',
      originY: 'top',
      overlayX: 'end',
      overlayY: 'top',
    },
    {
      originX: 'start',
      originY: 'bottom',
      overlayX: 'start',
      overlayY: 'top',
    },
  ];

  /** track by function for all calendars */
  trackCalendar: TrackByFunction<LocalCalendar> = (_: number, item: LocalCalendar) => {
    return item.calendar.id;
  }

  /** track by function for all events */
  trackEvent: TrackByFunction<DisplayEvent> = (_: number, item: DisplayEvent) => {
    return item.event.id;
  }

  /** Callback used when clicking on events. */
  onEventActivate(event: DisplayEvent, origin: HTMLElement) {
    if (this.activeEventID === event.event.id) {
      this.onDeactivate(null)
      return;
    }
    this.activeEventID = event.event.id;
    this.attachDetais(event, new ElementRef(origin));
  }

  onDeactivate(overlay: OverlayRef) {
    this.activeEventID = '';
    overlay?.dispose();

    if (overlay === this._eventDetailsOverlay) {
      this._eventDetailsOverlay = null;
    }
    this.cdr.markForCheck();
  }

  /** Callback function for a dblclick event on calendars. */
  onFilterDblClick(cal: LocalCalendar) {
    const id = cal.calendar.id;
    const all = this.calendars;
    // if all all calendars are hidden an we handle a double
    // click than display all again
    if (!all.filter(cal => cal.calendar.id !== id).some(cal => cal.displayed)) {
      all.forEach(cal => cal.displayed = true);
      this.updateCalendarMode();
      return;
    }

    all.forEach(val => {
      val.displayed = val.calendar.id === id;
    });

    this.updateCalendarMode();
    this.cdr.markForCheck();
  }

  /** Toggle visibility of cal */
  updateFilter(cal: LocalCalendar) {
    cal.displayed = !cal.displayed;

    this.updateCalendarMode();
  }

  showCreateEventModal(event: MouseEvent, cal: LocalCalendar) {
    let target: HTMLElement;
    let iter: HTMLElement = event.target as HTMLElement;
    while (!iter.classList.contains('times')) {
      if (iter.classList.contains('event')) {
        return;
      }
      iter = iter.parentElement;
      if (!iter) {
        break;
      }
    }
    if (!iter || this.activeEventID !== '') {
      this.activeEventID = '';
      return;
    }
    target = iter;

    const rect = target.getBoundingClientRect();
    const offset = event.y - rect.top;
    let minutes = offset * (60 / this.hourHeight);

    let realMinutes = minutes % 60;
    if (realMinutes <= 15) {
      realMinutes = 0;
    } else
      if (realMinutes <= 30) {
        realMinutes = 15
      } else
        if (realMinutes <= 45) {
          realMinutes = 30
        } else {
          realMinutes = 45
        }

    const duration = Duration.minutes(minutes);
    const current = this._currentDate$.getValue();
    let startTime = new Date(current.getFullYear(), current.getMonth(), current.getDate(), duration.hours, realMinutes)

    /*
    this.router.navigate(['/', 'create-event'], {
        queryParams: {
            calendar: cal.user?.name || cal.id,
            start: startTime.toISOString(),
        }
    })
    */

    const overlay = this.overlay.create({
      scrollStrategy: this.overlay.scrollStrategies.reposition(),
      positionStrategy: this.overlay.position()
        .flexibleConnectedTo(event.target as Element)
        .withPositions(this.positions),
    })

    let marker = this.createEventMarkers.find(elem => (elem.nativeElement as HTMLDivElement).getAttribute("calid") === cal.calendar.id)

    let user = this.userService.byCalendarID(cal.calendar.id)

    let data: CreateEventData = {
      start: startTime.toISOString(),
      duration: 15,
      summary: '',
      description: '',
      user: user,
      calName: cal.calendar.name,
      calID: cal.calendar.id,
      marker: marker,
      update: null,
      close: () => {
        // FIXME: use this one
        overlay.dispose();
        marker?.nativeElement.classList.add("hidden")
      }
    }

    data.update = () => {
      const el: HTMLDivElement = marker.nativeElement;
      el.classList.remove("hidden")
      el.style.top = coerceCssPixelValue(
        this.adjustToHours(this.offset(new Date(data.start)))
      )
      el.style.height = coerceCssPixelValue(data.duration * (this.hourHeight / 60))
      this.cdr.markForCheck();
    }

    data.update()

    overlay.attach(new TemplatePortal(
      this.createEventTemplate,
      this.viewContainer,
      {
        $implicit: data,
        overlay: overlay,
      }
    ))

    overlay.outsidePointerEvents()
      .pipe(take(1))
      .subscribe(() => overlay.dispose())
  }

  async createEvent(data: CreateEventData, overlay: OverlayRef) {
    const startSeconds = (new Date(data.start).getTime()) / 1000;

    try {

      await this.calendarapi.createEvent({
        name: data.summary,
        calendarId: data.calID,
        description: data.description,
        // TODO(extraData)
        start: {
          seconds: BigInt(startSeconds),
        },
        end: {
          seconds: BigInt(startSeconds + Duration.minutes(data.duration).seconds),
        }
      })

      overlay.dispose();
      this._currentDate$.next(this._currentDate$.getValue());
      data.marker?.nativeElement.classList.add('hidden');
    } catch (err) {
      this.nzMessageService.error(extractErrorMessage(err, 'Termin konnte nicht erstellt werden'))
    }
  }

  deleteEvent(event: DisplayEvent, overlay: OverlayRef) {
    const profile = this.userService.byCalendarID(event.event.calendarId);
    const calendar = this.calendars.find(cal => cal.calendar.id === event.event.calendarId);

    this.modal.confirm({
      nzTitle: "Termin löschen",
      nzContent: `Möchtest du "${event.event.summary}" von "${profile?.user?.displayName || profile?.user?.username || calendar.calendar.name}" um ${new Date(Number(event.event.startTime?.seconds || 0) * 1000).toLocaleTimeString()} wirklich löschen?`,
      nzOnOk: async () => {
        try {

          await this.calendarapi.deleteEvent({
            calendarId: event.event.calendarId,
            eventId: event.event.id,
          })

          this._currentDate$.next(this._currentDate$.getValue())
          overlay.dispose();
        } catch (err) {
          this.nzMessageService.error(extractErrorMessage(err, 'Termin konnte nicht gelöscht werden'))
        }
      }
    })
  }

  toggleAll() {
    const calendarId = getCalendarId(this.account.snapshot);

    switch (this.calendarMode) {
      case 'all': // => mine
        if (calendarId) {
          this.calendarMode = 'mine';
          // only display the calendar that belongs to the current user
          this.calendars.forEach(cal => cal.displayed = cal.calendar.id === calendarId)
          // if there's no calendar anymore to be displayed
          // toggle once more so we display all of them
          if (!this.calendars.some(cal => cal.displayed)) {
            this.toggleAll();
            return;
          }
          break;
        }
      // fallthrough if there's no calendar for this profile
      case 'mine':
        this.calendarMode = 'auto';
        this.calendars.forEach(cal => cal.displayed = cal.events?.length > 0)
        if (!this.calendars.some(cal => cal.displayed)) {
          this.toggleAll();
          return;
        }
        // do not call updateCalendarMode in "auto".
        this.updateDisplayCount()

        return;
      default:
        this.calendars.forEach(cal => cal.displayed = true);
    }

    this.updateCalendarMode();
  }

  private updateDisplayCount() {
    this.displayedCalendarCount = this.calendars
      .filter(cal => cal.displayed)
      .length
  }

  private updateCalendarMode() {
    const all = !this.calendars.some(cal => !cal.displayed);
    if (all) {
      this.calendarMode = 'all';
    } else {
      const onlyMine = !this.calendars.some(cal => {
        if (cal.calendar.id === getCalendarId(this.account.snapshot)) {
          return !cal.displayed;
        }
        return cal.displayed;
      })
      if (onlyMine) {
        this.calendarMode = 'mine';
      } else {
        this.calendarMode = 'selected';
      }
    }

    this.updateDisplayCount()

    this._layouting$.next();
  }

  @Input()
  set date(d: Date | string) {
    if (typeof d === 'string') {
      d = new Date(d);
    }
    this._currentDate$.next(d);
  }
  get date() {
    return this._currentDate$.getValue();
  }

  /** @private - action for prev-day button */
  prevDay() {
    const current = this._currentDate$.getValue();
    this.date = new Date(current.getFullYear(), current.getMonth(), current.getDate() - 1)
  }

  /** @private - action for next-day button */
  nextDay() {
    const current = this._currentDate$.getValue();
    this.date = new Date(current.getFullYear(), current.getMonth(), current.getDate() + 1)
  }

  readonly hours = [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23
  ]

  private calendarapi = inject(CALENDAR_SERVICE);

  constructor(
    private userService: UserService,
    private headerService: HeaderTitleService,
    private account: ProfileService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    private openingHoursAPI: OpeningHoursAPI,
    private viewContainer: ViewContainerRef,
    private overlay: Overlay,
    private modal: NzModalService,
    private nzMessageService: NzMessageService,
  ) { }

  ngOnInit() {
    let prevDate: Date | null = null;

    const start$ = interval(20000).pipe(startWith(-1));
    combineLatest([
      this._currentDate$,
      start$,
    ])
      .pipe(
        takeUntil(this._destroy$),
        switchMap(([date, _]) => {
          return forkJoin({
            openingHours: this.openingHoursAPI.getOpeningHours(date)
              .pipe(
                catchError(err => {
                  console.error("failed to load opening hours", err);
                  return of({
                    openingHours: [],
                    isHoliday: false,
                    onCallStartDay: null,
                    onCallStartNight: null,
                  } as OpeningHoursResponse<Date>)
                }),
                map(result => result.openingHours),
              ),
            roster: this.rosterService.getWorkingStaff({ time: Timestamp.fromDate(date) }),
            events: from(this.calendarapi.listEvents({
              searchTime: {
                case: 'date',
                value: formatDate(date, '/'),
              },
              source: {
                case: 'allCalendars',
                value: true
              },
            }))
              .pipe(
                map(response => response.results),
                catchError(err => of([] as CalendarEventList[])),
              ),
            date: of(date),
          })
        }),
      )
      .subscribe({
        next: result => {
          let changed = !prevDate || prevDate.valueOf() !== result.date.valueOf();

          this.openingHours = [];
          result.openingHours.forEach(oh => {
            this.openingHours.push({
              y: this.adjustToHours(this.offset(oh.from)) + 'px',
              height: this.adjustToHours(this.offset(oh.to) - this.offset(oh.from)) + 'px',
            })
          })

          this.roster = result.roster.userIds;

          const events = result.events;
          let lm = new Map<string, LocalCalendar>();
          let earliestEvent: number | null = null;

          ((this.scrollable.nativeElement as HTMLElement).firstChild as HTMLElement).style.height = `${24 * this.hourHeight}px`

          events.forEach(eventList => {
            const wasDisplayed = this.calendars.find(cal => cal.calendar.id === eventList.calendar.id)?.displayed;
            const user = this.userService.byCalendarID(eventList.calendar.id);
            if (wasDisplayed === undefined) {
              changed = true;
            }

            const userColor = (user ? getUserColor(user) : eventList.calendar.color) || '#ffffff'
            const fontColor = getContrastFontColor(userColor)

            const localCalendar: LocalCalendar = {
              calendar: eventList.calendar,
              user: user,
              displayed: wasDisplayed === undefined ? undefined : wasDisplayed,
              events: [],
              color: userColor,
              fontColor: fontColor,
            }

            lm.set(eventList.calendar.id, localCalendar);

            eventList.events.forEach(event => {
              const startTime = Number(event.startTime.seconds);
              if (earliestEvent === null || startTime < earliestEvent) {
                earliestEvent = startTime;
              }

              localCalendar.events.push({
                event: event,
                top: this.adjustToHours(this.offset(startTime)),
                offsettop: 0,
                height: event.endTime ? (this.adjustToHours(this.offset(event.endTime) - this.offset(event.startTime)) || 32) : 1,
                left: 0,
                color: localCalendar.color,
                fontColor: localCalendar.fontColor,
                overlapping: 0,
              });
            })

          });

          // ensure we have a stable calendar order
          this.calendars = Array.from(lm.values()).sort((a, b) => {
            if (a.calendar.name > b.calendar.name) {
              return 1;
            }
            if (a.calendar.name < b.calendar.name) {
              return -1;
            }
            return 0;
          });

          const usersByRoster = new Set<string>(this.roster || []);

          // determine if new calendars should start visible or not.
          // also make sure we have a stable event order
          this.calendars.forEach(cal => {
            // sort all events so we have a stable order.
            cal.events.sort((a, b) => {
              let diff = Number(a.event.startTime.seconds - b.event.startTime.seconds);
              if (diff !== 0) {
                return diff;
              }

              // same start time so make sure the longer one is above
              diff = b.height - a.height;
              if (diff !== 0) {
                return diff;
              }
              if (a.event.summary > b.event.summary) {
                return -1;
              }
              if (a.event.summary < b.event.summary) {
                return 1;
              }
              return 0;
            });

            // only update
            if (changed) {
              switch (this.calendarMode) {
                case 'all':
                  cal.displayed = true;
                  break;
                case 'auto':
                  cal.displayed = cal.events?.length > 0 || (!!cal.user && usersByRoster.has(cal.user.user.id));
                  break;
                case 'mine':
                  cal.displayed = cal.user.user.id === this.account.snapshot.user.id;
                  break;
                case 'selected':
                  // for "selected", we keep the current setting and only update
                  // it if it's a new calendar.
                  if (cal.displayed === undefined) {
                    cal.displayed = false;
                  }
                  break;
              }
            }

            this.updateDisplayCount()
          })
          this._layouting$.next();

          this.cdr.markForCheck();

          this.isToday = new Date().toDateString() === this._currentDate$.getValue().toDateString()
          this.currentTime = new Date();

          if (this.isToday) {
            this.todayOffset = this.adjustToHours(this.offset(new Date()));

            if (!this.inlineView) {
              this.headerService.set('Kalender: Heute')
            }
          } else {
            this.todayOffset = 0;
            if (!this.inlineView) {
              this.headerService.set('Kalender: ' + this._currentDate$.getValue().toLocaleDateString())
            }
          }

          // if we are in "auto" mode and no calendars are displayed we should
          // switch to the next one
          if (this.calendarMode === 'auto' && !this.calendars.some(cal => cal.displayed)) {
            // start at "all" and find the next view that works.
            // this actually skips "all" and will use it as a last resort.
            this.calendarMode = 'all';
            this.updateCalendarMode()
          }

          if (changed && !!this.scrollable) {
            let offset = this.isToday
              ? this.todayOffset - this.hourHeight / 4
              : this.adjustToHours(this.offset(earliestEvent));

            this.ngZone.onStable.pipe(take(1))
              .subscribe(() => {
                console.log(`scrolling to ${offset}`, this.scrollable.nativeElement)
                this.scrollable.nativeElement.scrollTo({
                  top: offset,
                  behavior: 'smooth'
                })
              })
          }

          prevDate = result.date;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: err => console.error(err)
      });

    this._layouting$.pipe(takeUntil(this._destroy$))
      .subscribe(() => {
        /** we need to re-evaluate those when we change filter */
        const sizePerCalendar = this.scrollable.nativeElement.getBoundingClientRect().width / this.calendars.filter(cal => cal.displayed).length;
        this.calendars.forEach(cal => {
          let stack: DisplayEvent[] = [];
          for (let i = 0; i < cal.events.length; i++) {
            const event = cal.events[i];
            stack = stack.filter(e => (e.top + e.height) > event.top)
            let overlapping = stack.length;

            while (true) {
              if (!stack.some(event => event.overlapping === overlapping)) {
                break;
              }
              overlapping++;
            }

            if (overlapping > 0) {
              event.overlapping = overlapping;
              event.left = overlapping * (sizePerCalendar / 10);
              event.offsettop = stack.filter(e => e.top === event.top).length * 5;
              event.color = this.ligthenColor(event.color, overlapping * 5);
              event.fontColor = getContrastFontColor(event.color);
            }
            stack.push(event);
            console.log(cal.calendar.name, event.event.summary, stack);
          }
        })
      })
  }

  ngOnDestroy() {
    this._destroy$.next();
    this._destroy$.complete();
  }

  private ligthenColor(color: string, percent: number) {
    let num = parseInt(color.replace("#", ""), 16),
      amt = Math.round(2.55 * percent),
      R = (num >> 16) + amt,
      B = (num >> 8 & 0x00FF) + amt,
      G = (num & 0x0000FF) + amt;

    return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 + (B < 255 ? B < 1 ? 0 : B : 255) * 0x100 + (G < 255 ? G < 1 ? 0 : G : 255)).toString(16).slice(1);
  };

  private offset(d: Date | number | Timestamp): number {
    if (d instanceof Timestamp) {
      d = Number(d.seconds)
    }
    if (typeof d === 'number') {
      d = new Date(d * 1000);
    }

    return (d.getHours() * 60) + d.getMinutes();
  }

  private adjustToHours(n: number): number {
    const factor = this.hourHeight / 60;
    return n * factor;
  }

  private attachDetais(event: DisplayEvent, origin: ElementRef<any>): void {
    const overlay = this.overlay.create({
      scrollStrategy: this.overlay.scrollStrategies.reposition(),
      positionStrategy: this.overlay.position()
        .flexibleConnectedTo(origin)
        .withPositions(this.positions),
    })

    overlay.attach(
      new TemplatePortal(
        this.eventDetailsTemplate,
        this.viewContainer,
        {
          $implicit: {
            ...event,
            user: this.userService.byCalendarID(event.event.calendarId),
          },
          overlay: overlay,
        }
      )
    )
    overlay.outsidePointerEvents()
      .pipe(take(1))
      .subscribe(() => {
        this.activeEventID = '';
        overlay.dispose()
        this.cdr.markForCheck();
      })
  }
}
