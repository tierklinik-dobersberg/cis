import { CdkScrollable } from '@angular/cdk/scrolling';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, Input, NgZone, OnDestroy, OnInit, TrackByFunction, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { colorSets } from '@swimlane/ngx-charts';
import { NzPopoverDirective } from 'ng-zorro-antd/popover';
import { BehaviorSubject, combineLatest, forkJoin, interval, of, Subject } from 'rxjs';
import { startWith, switchMap, take, takeUntil, tap } from 'rxjs/operators';
import { CalendarAPI, IdentityAPI, LocalEvent, ProfileWithAvatar, UserService } from 'src/app/api';
import { HeaderTitleService } from 'src/app/shared/header-title';
import { getContrastFontColor } from 'src/app/utils';
import { Duration } from 'src/utils/duration';

interface DisplayEvent extends LocalEvent {
    top: number;
    offsettop: number;
    height: number;
    left: number;
    color: string;
    fontColor: string;
}

interface Calendar {
    id: string;
    name: string;
    user?: ProfileWithAvatar;
    events: DisplayEvent[];
    displayed?: boolean;
    color: string;
    fontColor: string;
}

@Component({
    selector: 'app-calendar-day-view',
    templateUrl: './day-view.html',
    styleUrls: ['./day-view.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DayViewComponent implements OnInit, OnDestroy {
    /** emits and completes when the component is destroyed */
    private _destroy$ = new Subject<void>();

    /** The current day */
    private _currentDate$ = new BehaviorSubject<Date>(new Date());

    /** Used to request re-layouting of events. */
    private _layouting$ = new BehaviorSubject<void>(undefined)

    readonly hourHeight = 120;

    /** Whether or not the _currentDate$ is for today */
    isToday = false;

    /** offset from top for the today bars */
    todayOffset = 0;

    /** The current time */
    currentTime = new Date();

    /** All events for the selected day */
    calendars: Calendar[] = [];

    /** The currently active event id */
    activeEventID: string = '';

    /** The text for the filter button */
    filterButtonText = 'Alle'

    @ViewChild('scrollContainer', { static: true })
    scrollable: ElementRef;

    /** track by function for all calendars */
    trackCalendar: TrackByFunction<Calendar> = (_: number, item: Calendar) => {
        return item.id;
    }

    /** track by function for all events */
    trackEvent: TrackByFunction<DisplayEvent> = (_: number, item: DisplayEvent) => {
        return item._id;
    }

    /** Callback used when clicking on events. */
    onEventActivate(event: DisplayEvent) {
        if (this.activeEventID === event._id) {
            this.activeEventID = '';
            return;
        }
        this.activeEventID = event._id;
    }

    /** Callback function for a dblclick event on calendars. */
    onFilterDblClick(cal: Calendar) {
        const id = cal.id;
        const all = this.calendars;
        // if all all calendars are hidden an we handle a double
        // click than display all again
        if (!all.filter(cal => cal.id !== id).some(cal => cal.displayed)) {
            all.forEach(cal => cal.displayed = true);
            this.updateFilterButtonText();
            return;
        }

        all.forEach(val => {
            val.displayed = val.id === id;
        });
        this.updateFilterButtonText();
        this.cdr.markForCheck();
    }

    /** Toggle visibility of cal */
    updateFilter(cal: Calendar) {
        cal.displayed = !cal.displayed;
        this.updateFilterButtonText();
    }

    createEvent(event: MouseEvent, cal: Calendar) {
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
        const minutes = offset * (60 / this.hourHeight);
        const duration = Duration.minutes(minutes);
        const current = this._currentDate$.getValue();
        let startTime = new Date(current.getFullYear(), current.getMonth(), current.getDate(), duration.hours, duration.minutes - (duration.hours * 60))

        this.router.navigate(['/', 'create-event'], {
            queryParams: {
                calendar: cal.user?.name || cal.id,
                start: startTime.toISOString(),
            }
        })
    }

    toggleAll() {
        const all = !this.calendars.some(cal => !cal.displayed);
        if (!all) {
            this.calendars.forEach(cal => cal.displayed = true);
        } else {
            if (this.identityapi.currentProfile?.calendarID) {
                // only display the calendar that belongs to the current user
                this.calendars.forEach(cal => cal.displayed = cal.id === this.identityapi.currentProfile?.calendarID)
                // if there's no calendar anymore to be displayed
                // toggle once more so we display all of them
                if (!this.calendars.some(cal => cal.displayed)) {
                    this.toggleAll();
                    return;
                }
            }
        }
        this.updateFilterButtonText();
    }

    private updateFilterButtonText() {
        this._layouting$.next();
        const all = !this.calendars.some(cal => !cal.displayed);
        if (all) {
            this.filterButtonText = 'Alle Kalender'
        } else {
            const onlyMine = !this.calendars.some(cal => {
                if (cal.id === this.identityapi.currentProfile?.calendarID) {
                    return !cal.displayed;
                }
                return cal.displayed;
            })
            if (onlyMine) {
                this.filterButtonText = 'Mein Kalender'
            } else {
                this.filterButtonText = 'Ausgewählte Kalender';
            }
        }
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

    constructor(
        private calendarapi: CalendarAPI,
        private userService: UserService,
        private headerService: HeaderTitleService,
        private identityapi: IdentityAPI,
        private cdr: ChangeDetectorRef,
        private ngZone: NgZone,
        private router: Router,
        private elementRef: ElementRef,
    ) { }

    ngOnInit() {
        let first = true;
        const start$ = interval(20000).pipe(startWith(-1));
        combineLatest([
            this._currentDate$.pipe(
                tap(() => first = true),
            ),
            this.calendarapi.listCalendars(),
            start$,
        ])
            .pipe(
                takeUntil(this._destroy$),
                switchMap(([date, calendars, _]) => {
                    return forkJoin({
                        events: this.calendarapi.listEvents(date),
                        calendars: of(calendars),
                    })
                }),
            )
            .subscribe(result => {
                const events = result.events;
                let lm = new Map<string, Calendar>();
                let earliestEvent: Date | null = null;

                result.calendars.forEach(c => {
                    const wasDisplayed = this.calendars.find(cal => cal.id === c._id)?.displayed;
                    const user = this.userService.byCalendarID(c._id);
                    lm.set(c._id, {
                        id: c._id,
                        name: c.name,
                        user: user,
                        displayed: wasDisplayed === undefined ? undefined : wasDisplayed,
                        events: [],
                        color: user?.color || '#90EE90',
                        fontColor: user?.fontColor || '#000000',
                    })
                })

                events.forEach(event => {
                    let cal = lm.get(event.calendarID);
                    if (!cal) {
                        console.error("Event for unknown calendar", event)
                        return
                    }
                    if (earliestEvent === null || event.startTime.getTime() < earliestEvent.getTime()) {
                        earliestEvent = event.startTime;
                    }
                    cal.events.push({
                        ...event,
                        top: this.adjustToHours(this.offset(event.startTime)),
                        offsettop: 0,
                        height: event.endTime ? this.adjustToHours(this.offset(event.endTime) - this.offset(event.startTime)) : 1,
                        left: 0,
                        color: cal.color,
                        fontColor: cal.fontColor,
                    });
                });

                // ensure we have a stable calendar order
                this.calendars = Array.from(lm.values()).sort((a, b) => {
                    if (a.name > b.name) {
                        return 1;
                    }
                    if (a.name < b.name) {
                        return -1;
                    }
                    return 0;
                });

                // determine if new calendars should start visible or not.
                // also make sure we have a stable event order
                this.calendars.forEach(cal => {
                    // sort all events so we have a stable order.
                    cal.events.sort((a, b) => {
                        let diff = a.startTime.getTime() - b.startTime.getTime()
                        if (diff !== 0) {
                            return diff;
                        }

                        // same start time so make sure the longer one is above
                        diff = b.height - a.height;
                        if (diff !== 0) {
                            return diff;
                        }
                        if (a.summary > b.summary) {
                            return -1;
                        }
                        if (a.summary < b.summary) {
                            return 1;
                        }
                        return 0;
                    });


                    if (cal.displayed !== undefined) {
                        return;
                    }
                    cal.displayed = cal.events.length > 0;
                })
                this._layouting$.next();

                this.cdr.markForCheck();

                this.isToday = new Date().toDateString() === this._currentDate$.getValue().toDateString()
                this.currentTime = new Date();

                if (this.isToday) {
                    this.todayOffset = this.adjustToHours(this.offset(new Date()));
                    this.headerService.set('Kalender: Heute')
                } else {
                    this.todayOffset = 0;
                    this.headerService.set('Kalender: ' + this._currentDate$.getValue().toLocaleDateString())
                }
                this.updateFilterButtonText();

                if (first && !!this.scrollable) {
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
                    first = false;
                }
            }, err => console.error(err));

        this._layouting$.pipe(takeUntil(this._destroy$))
            .subscribe(() => {
                /** we need to re-evaluate those when we change filter */
                const sizePerCalendar = this.scrollable.nativeElement.getBoundingClientRect().width / this.calendars.filter(cal => cal.displayed).length;
                this.calendars.forEach(cal => {
                    let stack: DisplayEvent[] = [];
                    for (let i = 0; i < cal.events.length; i++) {
                        const event = cal.events[i];
                        stack = stack.filter(e => (e.top + e.height) > event.top)
                        if (stack.length > 0) {
                            event.left = stack.length * (sizePerCalendar / 10);
                            event.offsettop = stack.filter(e => e.top === event.top).length * 5;
                            event.color = this.ligthenColor(event.color, stack.length * 5);
                            event.fontColor = getContrastFontColor(event.color);
                        }
                        stack.push(event);
                        console.log(cal.name, event.summary, stack);
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

    private offset(d: Date): number {
        return (d.getHours() * 60) + d.getMinutes();
    }

    private adjustToHours(n: number): number {
        const factor = this.hourHeight / 60;
        return n * factor;
    }
}
