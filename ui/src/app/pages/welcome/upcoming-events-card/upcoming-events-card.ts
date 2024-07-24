import { ChangeDetectionStrategy, Component, TrackByFunction, effect, input, signal } from '@angular/core';
import { injectCurrentProfile, injectUserProfiles } from '@tierklinik-dobersberg/angular/behaviors';
import { Calendar, CalendarEvent, CalendarEventList } from '@tierklinik-dobersberg/apis';
import { BehaviorSubject, combineLatest, from, interval, of } from 'rxjs';
import { catchError, filter, map, mergeMap, startWith } from 'rxjs/operators';
import { injectCalendarService } from 'src/app/api/connect_clients';
import { getCalendarId } from 'src/app/services';
import { formatDate } from 'src/utils/duration';
import { getSeconds } from '../../calendar2/day-view/sort.pipe';

interface DisplayEvent {
  event: CalendarEvent;
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
export class UpcomingEventsCardComponent {
  private readonly calendarapi = injectCalendarService()
  private readonly profile= injectCurrentProfile()


  /** A list of upcoming calendar events */
  protected readonly events = signal<DisplayEvent[]>([]);

  /** The current display mode */
  protected readonly mode = signal<'currentUser' | 'selected'>('currentUser')

  /** Whether or not only future events will be shown */
  protected readonly showAll = signal(false);

  /** A lookup map for all calendars */
  protected readonly allCalendars = signal<Map<string, LocalCalendar>>(new Map);

  /** The currently hightlighted user, if any */
  public readonly highlightUser = input('');

  protected readonly profiles = injectUserProfiles();

  /** Triggers a reload of all calendar events */
  private reload = new BehaviorSubject<void>(undefined);

  /** Track-By function */
  trackEvent: TrackByFunction<DisplayEvent> = (_: number, event: DisplayEvent) => event.event.id;

  selectOnly(id: string) {
    this.mode.set('selected');

    const all = Array.from(this.allCalendars().values());
    // if all all calendars are hidden an we handle a double
    // click than display all again
    if (!all.filter(cal => cal.calendar.id !== id).some(cal => cal.displayed)) {
      all.forEach(cal => cal.displayed = true);
      return;
    }

    all.forEach(val => {
      val.displayed = val.calendar.id === id;
    });
  }
  
  constructor() {
    const ref = effect(() => {
      const profile = this.profile();
      if (!profile) {
        return
      }
      
      if (getCalendarId(profile) === null) {
        this.mode.set('selected');
      }
      
      ref.destroy();
    }, { allowSignalWrites: true })
  }

  ngOnInit() {
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

        const events = [];

        const calendarIdOfActiveUser = getCalendarId(this.profile())

        eventList.forEach(calendarEvents => {
          let isDisplayed = this.allCalendars().get(calendarEvents.calendar.id)?.displayed;

          if (isDisplayed === undefined) {
            if (this.mode() === 'currentUser') {
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
            .filter(evt => evt.startTime.toDate().getTime() >= threshold || this.showAll())
            .map(event => ({
              event: event,
              past: event.startTime.toDate().getTime() < now,
              duration: !!event.endTime ?  getSeconds(event.endTime) - getSeconds(event.startTime) : null
            }))
            .forEach(event => events.push(event));
        })

        events
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

        this.events.set(events)
        

        this.allCalendars.set(allCalendars);
      });
  }

  toggle() {
    this.showAll.set(!this.showAll());
    this.reload.next();
  }
}
