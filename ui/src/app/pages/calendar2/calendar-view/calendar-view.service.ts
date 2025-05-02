import { computed, effect, Injectable, signal, Signal } from '@angular/core';
import { Timestamp } from '@bufbuild/protobuf';
import { sortUserProfile } from '@tierklinik-dobersberg/angular/behaviors';
import {
  injectCalendarService,
  injectRosterService,
} from '@tierklinik-dobersberg/angular/connect';
import { getUserColor } from '@tierklinik-dobersberg/angular/pipes';
import {
  CalenarEventRequestKind,
  CustomerAnnotation,
  ListEventsResponse,
  Calendar as PbCalendar
} from '@tierklinik-dobersberg/apis/calendar/v1';
import { Profile } from '@tierklinik-dobersberg/apis/idm/v1';
import { PlannedShift, RosterType, WorkShift } from '@tierklinik-dobersberg/apis/roster/v1';
import { differenceInSeconds, endOfDay, isAfter, isBefore, isSameDay, startOfDay } from 'date-fns';
import { getCalendarId } from 'src/app/services';
import { toDateString } from 'src/app/utils';
import { getSeconds } from '../day-view/sort.pipe';
import { CalEvent } from './calendar-view.component';

export interface CalendarView {
  events: CalEvent[];
  workingStaff: Set<string>;
  calendars: PbCalendar[]; 
  shifts: PlannedShift[];
}

@Injectable()
export class CalendarViewService {
  // Abort controller for loading
  private abrt: AbortController | null = null;

  protected readonly calendarAPI = injectCalendarService();
  protected readonly rosterAPI = injectRosterService();

  public readonly viewState = computed(() => {
    const events = this._computedEvents();
    const workingStaff = this.workingStaff();
    const calendars = this.calendars();
    const shifts = this.shifts();

    if (!shifts || !calendars) {
      return null;
    }

    return {
      events,
      workingStaff,
      calendars,
      shifts,
    }
  })

  public reload() {
    this.loadEvents(this.date())
  }

  constructor(
    public readonly date: Signal<Date>,

    /** A list of available calendars */
    public readonly allCalendars: Signal<PbCalendar[]>,

    /** The roster-types to considere for working-staff and shifts */
    public readonly rosterTypes: Signal<RosterType[] | null>,

    /** All user profiles */
    public readonly profiles: Signal<Profile[]>,
  ) {

    // Effect to load users shifts
    effect(
      () => {
        const date = this.date();
        if (!date) {
          return;
        }

        this.loading.set(true);

        if (this.abrt) {
          this.abrt.abort()
        }

        const abrt = new AbortController();
        this.abrt = abrt;


        // clear out the shifts so we don't display anything until we got the new response.
        this.shifts.set([]);

        const getShifts = this.rosterAPI
          .getUserShifts({
            timerange: {
              from: Timestamp.fromDate(startOfDay(date)),
              to: Timestamp.fromDate(endOfDay(date)),
            },
            users: {
              allUsers: true,
            },
          }, { signal: abrt.signal })
          .then(response => {
            this.shiftDefinitions.set(response.definitions);
            this.shifts.set(response.shifts);

            console.log("got shifts", response.shifts)
          });

        const loadEvents = this.loadEvents(date, abrt)

        Promise.all([loadEvents, getShifts])
          .finally(() => {
            if (this.abrt == abrt) {
              this.loading.set(false);
              this.abrt = null
            }
          })
      },
      {
        allowSignalWrites: true,
      }
    );

  }

  // Private signals for computing the view state

  /** All planned shifts for the selected date */
  protected readonly shifts = signal<PlannedShift[]>([]);

  /** Work-shift definitions */
  protected readonly shiftDefinitions = signal<WorkShift[]>([]);

  /** The last ListeEventsResponse, if any */
  public readonly eventListResponse = signal<ListEventsResponse | null>(
    null
  );

  /** A list of working user IDs based on the planned work-shifts (roster) of the selected ate */
  protected readonly workingStaff = computed(() => {
    const shifts = this.shifts();
    const workingStaff = new Set<string>();

    shifts.forEach(shift => {
      shift.assignedUserIds.forEach(user => workingStaff.add(user));
    });

    return workingStaff;
  });

  /** A list of all shown calendars  */
  protected readonly calendars = computed(() => {
    const profiles = this.profiles();
    const calendars = this.allCalendars();
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

  /** A computed signal to prepare all calendar events for display */
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

  /** A computed signal that creates "fake" calendar events for working shifts */
  protected readonly _computedShiftEvents = computed(() => {
    const shifts = this.shifts();
    const profiles = this.profiles();
    const date = startOfDay(this.date());
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
          console.log("creating shift event for profile", profile)

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

    console.log("shift events", shiftEvents);
    return shiftEvents;
  });

  /** A computed signal that returns all events (calendar & shifts) to be displayed */
  protected readonly _computedEvents = computed(() => {
    const shiftEvents = this._computedShiftEvents();
    const events = this.events();

    console.log("shift events", shiftEvents)

    return [...shiftEvents, ...events];
  });

  // Public API surface

  /** Whether or not the current date is today */
  public readonly isToday = computed(() => {
    const date = this.date();
    if (!date) {
      return;
    }

    return isSameDay(date, new Date());
  });

  public readonly loading = signal(true);
    private loadEvents (date: Date, abrt?: AbortController): Promise<void> {
      return this.calendarAPI
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
          { signal: abrt?.signal }
        )
        .catch(err => {
          console.error("failed to load events for date ", date, err)

          return new ListEventsResponse({results: []})
        })
        .then(response => {
          this.eventListResponse.set(response || null)
        })
    }
}
