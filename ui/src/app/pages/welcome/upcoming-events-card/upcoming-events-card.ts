import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnDestroy, OnInit, TrackByFunction, inject } from '@angular/core';
import { Calendar, CalendarEvent, CalendarEventList, Profile, } from '@tierklinik-dobersberg/apis';
import { BehaviorSubject, Subscription, combineLatest, from, interval, of } from 'rxjs';
import { catchError, filter, map, mergeMap, startWith } from 'rxjs/operators';
import { UserService } from 'src/app/api';
import { CALENDAR_SERVICE } from 'src/app/api/connect_clients';
import { ProfileService } from 'src/app/services/profile.service';
import { formatDate } from 'src/utils/duration';

interface DisplayEvent {
  event: CalendarEvent;
  user?: Profile;
  past: boolean;
  duration?: number;
}

interface LocalCalendar {
  calendar: Calendar;
  displayed: boolean;
}

@Component({
  selector: 'app-upcoming-events-card',
  templateUrl: './upcoming-events-card.html',
  styleUrls: ['./upcoming-events-card.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UpcomingEventsCardComponent implements OnInit, OnDestroy {

  @Input()
  set highlightUser(s: string) {
    this._highlightUser = s;
    this.changeDetectorRef.markForCheck();
  }
  get highlightUser() { return this._highlightUser; }

  @Input()
  set selectUserFilter(user: string) {
    const all = Array.from(this.allCalendars.values());
    if (user === '' && this._externalUserFilter !== '') {
      all.forEach(cal => cal.displayed = true);
      this._externalUserFilter = '';
      this.changeDetectorRef.markForCheck();
      return;
    }

    if (user !== '') {
      all.forEach(cal => cal.displayed = cal.calendar.name === user);
      this._externalUserFilter = user;
      this.changeDetectorRef.markForCheck();
      return;
    }
  }
  private _externalUserFilter = '';

  private readonly calendarapi = inject(CALENDAR_SERVICE);
  private readonly profileSerivce = inject(ProfileService);

  constructor(
    private userService: UserService,
    private changeDetectorRef: ChangeDetectorRef,
  ) { }
  private subscription = Subscription.EMPTY;

  /** A list of upcoming calendar events */
  events: DisplayEvent[] = [];

  /** The current display mode */
  mode: 'currentUser' | 'selected' = 'currentUser';

  /** Whether or not only future events will be shown */
  showAll = false;

  /** A lookup map for all calendars */
  allCalendars: Map<string, LocalCalendar> = new Map();

  /** The currently hightlighted user, if any */
  private _highlightUser = '';

  /** Triggers a reload of all calendar events */
  private reload = new BehaviorSubject<void>(undefined);

  /** Track-By function */
  trackEvent: TrackByFunction<DisplayEvent> = (_: number, event: DisplayEvent) => event.event.id;

  selectOnly(id: string) {
    this.mode = 'selected';

    const all = Array.from(this.allCalendars.values());
    // if all all calendars are hidden an we handle a double
    // click than display all again
    if (!all.filter(cal => cal.calendar.id !== id).some(cal => cal.displayed)) {
      all.forEach(cal => cal.displayed = true);
      return;
    }

    all.forEach(val => {
      val.displayed = val.calendar.id === id;
    });

    this.changeDetectorRef.markForCheck();
  }

  ngOnInit() {
    this.subscription = new Subscription();

    if (this.profileSerivce.calendarId() === null) {
      this.mode = 'selected';
    }

    const events = combineLatest([
      interval(10000).pipe(startWith(-1)),
      this.reload,
    ])
      .pipe(
        mergeMap(() => from(this.calendarapi.listEvents({
          searchTime: {
            case: 'date',
            value: formatDate(new Date(), '/'),
          },
          source: {
            case: 'allCalendars',
            value: true
          }
        }))),
        map(response => response.results),
        catchError(err => of(null as CalendarEventList[])),
        filter(events => events !== null),
      )
      .subscribe(eventList => {
        const now = new Date().getTime();
        const threshold = new Date().getTime() - 20 * 60 * 1000;

        let allCalendars = new Map<string, LocalCalendar>();

        this.events = [];

        const calendarIdOfActiveUser = this.profileSerivce.calendarId();

        eventList.forEach(calendarEvents => {
          let isDisplayed = this.allCalendars.get(calendarEvents.calendar.id)?.displayed;

          if (isDisplayed === undefined) {
            if (this.mode === 'currentUser') {
              isDisplayed = calendarEvents.calendar.id === calendarIdOfActiveUser;
            } else {
              isDisplayed = true
            }
          }

          allCalendars.set(
            calendarEvents.calendar.id,
            {
              calendar: calendarEvents.calendar!,
              displayed: isDisplayed,
            }
          )

          calendarEvents.events
            .filter(evt => !evt.fullDay)
            .filter(evt => evt.startTime.toDate().getTime() >= threshold || this.showAll)
            .map(event => ({
              event: event,
              past: event.startTime.toDate().getTime() < now,
              user: this.userService.byCalendarID(event.calendarId),
              duration: !!event.endTime ? (event.endTime.toDate().getTime() - event.startTime.toDate().getTime()) / 1000 : null,
            }))
            .forEach(event => this.events.push(event));
        })

        this.events
          .sort((a, b) => {
            const diff = Number(a.event.startTime.seconds - b.event.startTime.seconds);
            if (diff !== 0) {
              return diff;
            }

            if (a.event.id > b.event.id) {
              return 1;
            }

            return -1;
          })

        this.allCalendars = allCalendars;

        this.changeDetectorRef.markForCheck();
      });

    this.subscription.add(events);
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  toggle() {
    this.showAll = !this.showAll;
    this.reload.next();
  }
}
