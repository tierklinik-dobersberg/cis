import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, OnDestroy, OnInit, Output, Renderer2 } from '@angular/core';
import { NzMessageService } from 'ng-zorro-antd/message';
import { BehaviorSubject, forkJoin, Observable, of, Subject } from 'rxjs';
import { bufferTime, catchError, debounceTime, mergeMap, takeUntil, tap } from 'rxjs/operators';
import { CalendarAPI, Day, LocalEvent, OpeningHour, OpeningHoursAPI, ProfileWithAvatar, RosterAPI, UserService } from 'src/app/api';
import { extractErrorMessage } from 'src/app/utils';
import { Duration } from 'src/utils/duration';

export interface TimeSlot {
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
}

export interface SelectedTime {
    date: Date;
    duration: Duration;
    user?: ProfileWithAvatar;
    calendarID?: string;
}

@Component({
    selector: 'app-quick-time-selector',
    templateUrl: './quick-time-selector.html',
    styleUrls: ['./quick-time-selector.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuickTimeSelectorComponent implements OnInit, OnDestroy {
    private destroy$ = new Subject();
    private onDate$ = new BehaviorSubject<Date>(new Date());

    /** template variables */
    isHoliday: boolean | null = null;
    timeSlots: TimeSlot[] = [];
    loading = true;
    allUsers: ProfileWithAvatar[] = [];
    highlightedUserSlot: string = '';
    selectedUser: string = '';
    tooltipTimeStart: Date | null = null;
    tooltipTimeEnd: Date | null = null;
    tooltipEvents: LocalEvent[] = [];

    selectRangeStart(slot: TimeSlot, user: string, downEvent: MouseEvent) {
        if (slot.disabled) {
            return;
        }

        let updateSlots$ = new Subject<MouseEvent>();
        const slotSize = (downEvent.target as HTMLSpanElement).clientWidth;
        const start = (downEvent.target as HTMLSpanElement).getBoundingClientRect().x;
        const index = this.timeSlots.findIndex(s => s === slot);
        this.selectedUser = user;
        this.timeSlots.forEach(s => s.selected = false);
        slot.selected = true;

        let stopMouseMove = this.renderer.listen(document, "mousemove", event => {
            updateSlots$.next(event);
        })

        let stopMouseUp = this.renderer.listen(document, "mouseup", event => {
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
                    const selectedSlots = this.timeSlots.filter(s => s.selected);
                    if (!selectedSlots || selectedSlots.length === 0) {
                        this.selectedTime.next(null);
                        return;
                    }
                    const from = selectedSlots[0].from;
                    const to = selectedSlots[selectedSlots.length - 1].to
                    const duration = Duration.milliseconds(to.getTime() - from.getTime());

                    this.selectedTime.next({
                        date: from,
                        duration: duration,
                        user: this.users.byName(this.selectedUser),
                    })
                    stopMouseMove()
                    stopMouseUp()
                })

        updateSlots$.next(downEvent);
    }

    @Input()
    set date(d: Date | string) {
        if (typeof d === 'string') {
            d = new Date(d);
        }
        this._date = d;
        this.onDate$.next(this._date);
        console.log("new date selected");
    }
    get date() { return this._date; }
    private _date: Date = new Date()

    @Output()
    selectedTime = new EventEmitter<SelectedTime>();

    constructor(
        private rosterapi: RosterAPI,
        private calendarapi: CalendarAPI,
        private openinghoursapi: OpeningHoursAPI,
        private users: UserService,
        private cdr: ChangeDetectorRef,
        private nzMessageService: NzMessageService,
        private renderer: Renderer2,
    ) { }

    ngOnInit() {
        this.onDate$.pipe(
            takeUntil(this.destroy$),
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
                })
            }),
            tap(() => this.loading = false))
            .subscribe(result => {
                console.log(result);
                this.resetView()
                if (!result.openinghours) {
                    // TODO(ppacher): fall back to simple "create-event" mode
                    return;
                }

                this.isHoliday = result.openinghours.isHoliday;
                let day: Day | null = null;
                if (!!result.roster) {
                    day = result.roster.days[result.date.getDate()]
                }
                if (!day) {
                    this.nzMessageService.error("Kein Dienstplan definiert")
                    return;
                }
                this.updateTimeSlots(result.openinghours.openingHours, day, result.events)
                this.cdr.markForCheck();
            })
    }

    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
    }

    selectSlot(slot: TimeSlot | null, user?: string) {
        /*
        if (!slot) {
            this.selectedUser = '';
            this.timeSlots.forEach(slot => slot.selected = false);
            return;
        }
        this.selectedUser = user;
        slot.selected = !slot.selected;
        */
    }

    highlightSlot(user: string, slot: TimeSlot | null) {
        if (slot === null) {
            this.highlightedUserSlot = '';
            this.timeSlots.forEach(slot => slot.highlighted = false)
            return;
        }
        this.highlightedUserSlot = user;
        let ids = new Set<string>();
        (slot.users[user] || []).forEach(event => ids.add(event._id));

        this.timeSlots.forEach(s => {
            s.highlighted = (s.users[user] || []).some(event => ids.has(event._id))
        })
        // make sure the current slot is always highlighted
        slot.highlighted = true;

        let highlightdSlots = this.timeSlots.filter(slot => slot.highlighted);

        this.tooltipTimeStart = highlightdSlots[0].from;
        this.tooltipTimeEnd = highlightdSlots[highlightdSlots.length - 1].to;
        let m = new Map<string, LocalEvent>()

        this.tooltipEvents = slot.users[user];
    }

    private loadOrNull<T>(obs: Observable<T>): Observable<T | null> {
        return obs.pipe(catchError(err => {
            if (err.status !== 404) {
                this.nzMessageService.error(
                    extractErrorMessage(err)
                )
            }
            return of(null as T);
        }))
    }

    private resetView() {
        this.isHoliday = null;
        this.timeSlots = [];
        this.selectedTime.next(null);
    }

    private updateTimeSlots(openinghours: OpeningHour[], day: Day, events?: LocalEvent[]) {
        let earliestDate: Date | null = null;
        let latestDate: Date | null = null;

        openinghours.forEach(frame => {
            if (earliestDate === null || frame.from.getTime() < earliestDate.getTime()) {
                earliestDate = frame.from;
            }

            if (latestDate === null || frame.to.getTime() > latestDate.getTime()) {
                latestDate = frame.to;
            }
        });

        if (earliestDate === null) {
            // TODO(ppacher): no opening hour on that day
            return;
        }

        let isInFrame = (d: Date) => {
            const ts = d.getTime();
            return openinghours.some(frame => frame.from.getTime() <= ts && frame.to.getTime() >= ts)
        }

        let eventMap = new Map<string, LocalEvent[]>();
        (events || []).forEach(event => {
            if (!event.username) {
                return;
            }
            console.log(event);
            let arr = eventMap.get(event.username) || [];
            arr.push(event),
                eventMap.set(event.username, arr);
        })

        const slotSize = Duration.minutes(15);
        const threshold = new Date(earliestDate.getFullYear(), earliestDate.getMonth(), earliestDate.getDate(), 12, 0, 0).getTime()

        this.allUsers = [];
        let userSet = new Set([
            ...day.forenoon,
            ...day.afternoon,
            ...day.onCall.day,
            ...day.onCall.night,
        ]);
        userSet.forEach(user => {
            this.allUsers.push(this.users.byName(user))
        });

        const now = new Date().getTime();

        this.timeSlots = [];
        for (let iter = earliestDate; iter.getTime() < latestDate.getTime(); iter = slotSize.addTo(iter)) {
            let usersSlot: string[];
            let isOpeningHour = isInFrame(iter);
            let end = slotSize.addTo(iter);

            if (!isOpeningHour) {
                // FIXME(ppacher): expose day/night shift changes
                usersSlot = [...day?.onCall.day, ...day?.onCall.night];
            } else if (iter.getTime() <= threshold) {
                usersSlot = day?.forenoon;
            } else {
                usersSlot = day?.afternoon;
            }

            let users: TimeSlot['users'] = {};
            let available: TimeSlot['available'] = {};
            (usersSlot || []).forEach(user => {
                users[user] = (eventMap.get(user) || []).filter(event => {
                    if (!event.endTime) {
                        return false;
                    }

                    let eventStart = event.startTime.getTime();
                    let eventEnd = event.endTime!.getTime();
                    let slotStart = iter.getTime();

                    return slotStart >= eventStart && slotStart < eventEnd;
                });
                available[user] = true;
            })

            this.timeSlots.push({
                from: iter,
                to: end,
                users: users,
                available: available,
                isOpeningHour: isOpeningHour,
                highlighted: false,
                selected: false,
                disabled: iter.getTime() < now,
            })
        }
    }
}