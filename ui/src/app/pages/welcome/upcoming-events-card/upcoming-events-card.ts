import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnDestroy, OnInit, TrackByFunction } from '@angular/core';
import { ProfileWithAvatar } from '@tkd/api';
import { BehaviorSubject, combineLatest, interval, of, Subscription } from 'rxjs';
import { catchError, filter, mergeMap, startWith } from 'rxjs/operators';
import { CalendarAPI, LocalEvent, UserService } from 'src/app/api';

interface DisplayEvent extends LocalEvent {
    user?: ProfileWithAvatar;
    past: boolean;
    duration?: number;
}

interface Calendar {
    name: string;
    id: string;
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
            all.forEach(cal => cal.displayed = cal.name === user);
            this._externalUserFilter = user;
            this.changeDetectorRef.markForCheck();
            return;
        }
    }
    private _externalUserFilter = '';

    constructor(
        private calendarapi: CalendarAPI,
        private userService: UserService,
        private changeDetectorRef: ChangeDetectorRef,
    ) { }
    private subscription = Subscription.EMPTY;

    events: DisplayEvent[] = [];
    showAll = false;
    allCalendars: Map<string, Calendar> = new Map();
    private _highlightUser = '';

    private reload = new BehaviorSubject<void>(undefined);

    trackEvent: TrackByFunction<DisplayEvent> = (_: number, event: DisplayEvent) => event._id;

    selectOnly(id: string) {
        const all = Array.from(this.allCalendars.values());
        // if all all calendars are hidden an we handle a double
        // click than display all again
        if (!all.filter(cal => cal.id !== id).some(cal => cal.displayed)) {
            all.forEach(cal => cal.displayed = true);
            return;
        }

        all.forEach(val => {
            val.displayed = val.id === id;
        });
        this.changeDetectorRef.markForCheck();
    }

    ngOnInit() {
        this.subscription = new Subscription();

        const events = combineLatest([
            interval(10000).pipe(startWith(-1)),
            this.reload,
        ])
            .pipe(
                mergeMap(() => this.calendarapi.listEvents()),
                catchError(err => of(null as LocalEvent[])),
                filter(events => events !== null),
            )
            .subscribe(events => {
                const now = new Date().getTime();
                const threshold = new Date().getTime() - 20 * 60 * 1000;
                this.events = events
                    .filter(evt => !evt.fullDayEvent)
                    .filter(evt => evt.startTime.getTime() >= threshold || this.showAll)
                    .sort((a, b) => {
                        const diff = a.startTime.getTime() - b.startTime.getTime();
                        if (diff !== 0) {
                            return diff;
                        }

                        if (a._id > b._id) { return 1; }
                        return -1;
                    })
                    .map(event => ({
                        ...event,
                        past: event.startTime.getTime() < now,
                        user: this.userService.byName(event.username),
                        duration: !!event.endTime ? (event.endTime.getTime() - event.startTime.getTime()) / 1000 : null,
                    }));

                // create a list of displayed calendars.
                const calMap = new Map<string, Calendar>();
                this.events.forEach(evt => {
                    const name = evt.user ? evt.user.fullname : evt.calendarName;
                    let isDisplayed = this.allCalendars.get(evt.calendarID)?.displayed;
                    if (isDisplayed === undefined) {
                        isDisplayed = true;
                    }

                    calMap.set(evt.calendarID, {
                        id: evt.calendarID,
                        name,
                        displayed: isDisplayed,
                    });
                });
                this.allCalendars = calMap;

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
