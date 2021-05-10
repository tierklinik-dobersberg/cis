import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, OnDestroy, OnInit, Output, Renderer2 } from '@angular/core';
import { valueFunctionProp } from 'ng-zorro-antd/core/util';
import { NzMessageService } from 'ng-zorro-antd/message';
import { BehaviorSubject, combineLatest, forkJoin, Observable, of, Subject } from 'rxjs';
import { catchError, debounceTime, mergeMap, takeUntil, tap } from 'rxjs/operators';
import { Calendar, CalendarAPI, ConfigAPI, Day, LocalEvent, OpeningHour, OpeningHoursAPI, ProfileWithAvatar, RosterAPI, UIConfig, UserService } from 'src/app/api';
import { extractErrorMessage } from 'src/app/utils';
import { Duration } from 'src/utils/duration';

export interface SelectedTime {
    date: Date;
    duration: Duration;
    user?: ProfileWithAvatar;
    calendarID?: string;
}

interface TimeSlot {
    from: Date;
    to: Date;
    isOpeningHour: boolean;
    users: {
        [username: string]: LocalEvent[]
    };
    available: {
        [username: string]: boolean;
    };
    highlighted: boolean;
    selected: boolean;
    disabled: boolean;
    allResourcesFree: boolean;
}

type SlotUser = Partial<ProfileWithAvatar> & { isCalendar?: boolean };

@Component({
    selector: 'app-quick-time-selector',
    templateUrl: './quick-time-selector.html',
    styleUrls: ['./quick-time-selector.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuickTimeSelectorComponent implements OnInit, OnDestroy {

    @Input()
    set resourcesRequired(v: string[]) {
        this._resourcesRequired = new Set<string>(v);
        this.onResourcesRequired$.next(this._resourcesRequired);
    }
    get resourcesRequired() { return Array.from(this._resourcesRequired); }

    @Input()
    set date(d: Date | string) {
        if (typeof d === 'string') {
            d = new Date(d);
        }
        this._date = d;
        this.onDate$.next(this._date);
    }
    get date() { return this._date; }

    constructor(
        private rosterapi: RosterAPI,
        private calendarapi: CalendarAPI,
        private openinghoursapi: OpeningHoursAPI,
        private configapi: ConfigAPI,
        private users: UserService,
        private cdr: ChangeDetectorRef,
        private nzMessageService: NzMessageService,
        private renderer: Renderer2,
    ) { }

    private destroy$ = new Subject();
    private onDate$ = new BehaviorSubject<Date>(new Date());

    /** Whether or not the current day is a public holiday */
    isHoliday: boolean | null = null;

    /** The available time slots */
    timeSlots: TimeSlot[] = [];

    /** Whether or not we are currently loading. */
    loading = true;

    /** All available users/calendars */
    allUsers: SlotUser[] = [];

    /** The currently hightlighted user slot */
    highlightedUserSlot = '';

    /** The selected user name or calendar ID. */
    selectedUser = '';

    /** All available calendars. */
    calendars: Calendar[] = [];

    /** Start time for the tooltip */
    tooltipTimeStart: Date | null = null;

    /** End time for the tooltip */
    tooltipTimeEnd: Date | null = null;

    /** All events that should be displayed in the tooltip */
    tooltipEvents: LocalEvent[] = [];

    /** A set of required resources. */
    _resourcesRequired = new Set<string>();

    selectedStart: Date | null = null;
    selectedEnd: Date | null = null;

    /** Used to trigger a re-layouting/re-creating of time-slots if resources change */
    private onResourcesRequired$ = new BehaviorSubject<Set<string>>(new Set());

    /** The current date displayed by this component. */
    private _date: Date = new Date();

    @Output()
    selectedTimeChange = new EventEmitter<SelectedTime>();

    @Input()
    set selectedTime(v: SelectedTime) {
        if (this._done) {
            return;
        }

        if (!v && !!this.selectedUser) {
            this.selectedUser = '';
            this.selectedStart = null;
            this.selectedEnd = null;
            this.date = new Date();
            return;
        }

        this.selectedUser = v.user?.name || v.calendarID;
        this.selectedStart = v.date;
        this.selectedEnd = new Date(v.date.getTime() + v.duration.milliseconds);
        this.date = v.date;
    };
    private _done = false;

    selectRangeStart(slot: TimeSlot, user: string, downEvent: MouseEvent) {
        if (slot.disabled) {
            return;
        }

        const updateSlots$ = new Subject<MouseEvent>();
        const slotSize = (downEvent.target as HTMLSpanElement).clientWidth;
        const start = (downEvent.target as HTMLSpanElement).getBoundingClientRect().x;
        const index = this.timeSlots.findIndex(s => s === slot);
        this.selectedUser = user;
        this.timeSlots.forEach(s => s.selected = false);
        slot.selected = true;

        const stopMouseMove = this.renderer.listen(document, 'mousemove', event => {
            updateSlots$.next(event);
        });

        const stopMouseUp = this.renderer.listen(document, 'mouseup', event => {
            updateSlots$.next(event);
            updateSlots$.complete();
        });

        updateSlots$.pipe(
            takeUntil(this.destroy$))
            .subscribe(
                event => {
                    const diffX = event.clientX - start;
                    const offsetSlots = Math.floor(diffX / slotSize);
                    this.timeSlots.forEach(s => s.selected = false);

                    let slots: TimeSlot[] = [];
                    if (offsetSlots > 0) {
                        slots = this.timeSlots.slice(index, index + offsetSlots + 1);
                    } else {
                        slots = this.timeSlots.slice(index + offsetSlots, index + 1);
                    }
                    slot.selected = true;
                    slots.forEach(s => {
                        if (!s.disabled) {
                            s.selected = true;
                        }
                    });
                },
                () => { },
                () => {
                    this.emitSelectedTime();

                    stopMouseMove();
                    stopMouseUp();
                });

        updateSlots$.next(downEvent);
    }

    private emitSelectedTime() {
        const selectedSlots = this.timeSlots.filter(s => s.selected);
        if (!selectedSlots || selectedSlots.length === 0) {
            this.selectedTimeChange.next(null);
            return;
        }
        const from = selectedSlots[0].from;
        const to = selectedSlots[selectedSlots.length - 1].to;
        const duration = Duration.milliseconds(to.getTime() - from.getTime());

        this.selectedStart = from;
        this.selectedEnd = to;

        this.selectedTimeChange.next({
            date: from,
            duration,
            user: this.users.byName(this.selectedUser),
        });
    }

    ngOnInit() {
        this._done = true;
        combineLatest([
            this.onDate$.pipe(
                debounceTime(10),
                mergeMap(d => {
                    this.loading = true;
                    return forkJoin({
                        date: of(d),
                        roster: this.loadOrNull(
                            this.rosterapi.forMonth(d)
                        ),
                        openinghours: this.loadOrNull(
                            this.openinghoursapi.getOpeningHours(d)
                        ),
                        events: this.loadOrNull(
                            this.calendarapi.listEvents(d)
                        )
                    });
                })),
            this.loadOrNull(this.calendarapi.listCalendars()),
            this.configapi.change,
            this.onResourcesRequired$,
        ]).pipe(
            debounceTime(100),
            takeUntil(this.destroy$),
            tap(() => this.loading = false)
        )
            .subscribe(([result, calendars, config]) => {
                this.calendars = calendars || [];

                this.resetView();
                if (!result.openinghours) {
                    // TODO(ppacher): fall back to simple "create-event" mode
                    return;
                }

                this.isHoliday = result.openinghours.isHoliday;
                let day: Day | null = null;
                if (!!result.roster) {
                    day = result.roster.days[result.date.getDate()];
                }
                this.updateTimeSlots(result.openinghours.openingHours, day, config, result.events);
                this.emitSelectedTime();
                this.cdr.markForCheck();
            });
    }

    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
    }

    highlightSlot(user: string, slot: TimeSlot | null) {
        if (slot === null) {
            this.highlightedUserSlot = '';
            this.timeSlots.forEach(slot => slot.highlighted = false);
            return;
        }
        this.highlightedUserSlot = user;
        const ids = new Set<string>();
        (slot.users[user] || []).forEach(event => ids.add(event._id));

        this.timeSlots.forEach(s => {
            s.highlighted = (s.users[user] || []).some(event => ids.has(event._id));
        });
        // make sure the current slot is always highlighted
        slot.highlighted = true;

        const highlightdSlots = this.timeSlots.filter(slot => slot.highlighted);

        this.tooltipTimeStart = highlightdSlots[0].from;
        this.tooltipTimeEnd = highlightdSlots[highlightdSlots.length - 1].to;
        const m = new Map<string, LocalEvent>();

        this.tooltipEvents = slot.users[user];
    }

    private loadOrNull<T>(obs: Observable<T>): Observable<T | null> {
        return obs.pipe(catchError(err => {
            if (err.status !== 404) {
                this.nzMessageService.error(
                    extractErrorMessage(err)
                );
            }
            return of(null as T);
        }));
    }

    private resetView() {
        this.isHoliday = null;
        this.timeSlots = [];
        //this.selectedTimeChange.next(null);
    }

    private updateTimeSlots(openinghours: OpeningHour[], day?: Day, config?: UIConfig, events?: LocalEvent[]) {
        let [earliestDate, latestDate] = this.getEarliestAndLatestDate(openinghours);
        if (earliestDate === null) {
            // TODO(ppacher): no opening hour on that day
            return;
        }

        const isInFrame = (d: Date) => {
            const ts = d.getTime();
            return openinghours.some(frame => frame.from.getTime() <= ts && frame.to.getTime() >= ts);
        };

        const eventMap = new Map<string, LocalEvent[]>();
        (events || []).forEach(event => {
            const arr = eventMap.get(event.username || event.calendarID) || [];
            arr.push(event)
            eventMap.set(event.username || event.calendarID, arr);
        });

        const slotSize = Duration.minutes(15);
        const threshold = new Date(earliestDate.getFullYear(), earliestDate.getMonth(), earliestDate.getDate(), 12, 0, 0).getTime();

        let [allUsers, unassignedCalendars, hasRoster] = this.getAllAvailableUsers(day, config);
        this.allUsers = allUsers;

        const now = new Date().getTime();

        let startSelected = this.selectedStart?.getTime() || Infinity;
        let endSelected = this.selectedEnd?.getTime() || 0
        this.timeSlots = [];
        for (let iter = earliestDate; iter.getTime() < latestDate.getTime(); iter = slotSize.addTo(iter)) {
            let usersSlot: string[];
            const isOpeningHour = isInFrame(iter);
            const end = slotSize.addTo(iter);

            if (hasRoster) {
                if (!isOpeningHour) {
                    // FIXME(ppacher): expose day/night shift changes
                    usersSlot = [...day?.onCall.day, ...day?.onCall.night];
                } else if (iter.getTime() <= threshold) {
                    usersSlot = day?.forenoon;
                } else {
                    usersSlot = day?.afternoon;
                }
                usersSlot = [
                    ...usersSlot,
                    ...unassignedCalendars,
                ]
            } else {
                usersSlot = this.allUsers.map(u => u.name);
            }

            const users: TimeSlot['users'] = {};
            const available: TimeSlot['available'] = {};
            (usersSlot || []).forEach(user => {
                users[user] = (eventMap.get(user) || []).filter(event => {
                    if (!event.endTime) {
                        return false;
                    }

                    const eventStart = event.startTime.getTime();
                    const eventEnd = event.endTime!.getTime();
                    const slotStart = iter.getTime();

                    return slotStart >= eventStart && slotStart < eventEnd;
                });
                available[user] = true;
            });

            const allResourcesFree = !Object.keys(users).some(key => {
                return users[key].some(event => !!event.data?.requiredResources?.some(res => this._resourcesRequired.has(res)));
            });

            const iterMs = iter.getTime();
            const toMs = end.getTime();
            const selected = startSelected <= iterMs && endSelected >= iterMs;


            this.timeSlots.push({
                from: iter,
                to: end,
                users,
                available,
                isOpeningHour,
                highlighted: false,
                selected: selected,
                disabled: iter.getTime() < now,
                allResourcesFree,
            });
        }
    }

    private getEarliestAndLatestDate(hours: OpeningHour[]): [Date, Date] {
        let earliestDate: Date | null = null;
        let latestDate: Date | null = null;
        hours.forEach(frame => {
            if (earliestDate === null || frame.from.getTime() < earliestDate.getTime()) {
                earliestDate = frame.from;
            }

            if (latestDate === null || frame.to.getTime() > latestDate.getTime()) {
                latestDate = frame.to;
            }
        });
        return [earliestDate, latestDate]
    }

    private getAllAvailableUsers(day?: Day, config?: UIConfig): [SlotUser[], string[], boolean] {
        let allUsers: SlotUser[] = [];
        let userSet = new Set<string>();
        if (!!day) {
            userSet = new Set([
                ...day.forenoon,
                ...day.afternoon,
                ...day.onCall.day,
                ...day.onCall.night,
            ]);
        }

        // check if we have a roster day and if there are acutually users
        // assigned for the different shifts.
        if (!!day && userSet.size > 0) {
            userSet.forEach(user => {
                allUsers.push(this.users.byName(user));
            });

            let unassignedCalendars: string[] = [];
            (config.CreateEventAlwaysAllowCalendar || []).forEach(calID => {
                const cal = this.calendars.find(cal => cal._id === calID);
                if (!cal) {
                    this.nzMessageService.error("Kalender mit ID " + calID + " nicht gefunden")
                    return;
                }
                unassignedCalendars.push(cal._id);
                allUsers.push({
                    name: cal._id,
                    fullname: cal.name,
                    isCalendar: true,
                })
            })
            return [allUsers, unassignedCalendars, true];
        }

        // we don't have a roster for that day so we need to fallback to all
        // available calendars.
        return [this.calendars.map(cal => ({
            name: cal._id,
            fullname: cal.name,
            isCalendar: true,
        })), [], false]
    }
}
