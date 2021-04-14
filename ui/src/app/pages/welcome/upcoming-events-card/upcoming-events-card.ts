import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnDestroy, OnInit, TrackByFunction } from "@angular/core";
import { BehaviorSubject, combineLatest, interval, of, Subscription } from "rxjs";
import { catchError, filter, mergeMap, startWith } from "rxjs/operators";
import { CalendarAPI, LocalEvent, ProfileWithAvatar, UserService } from "src/app/api";

interface DisplayEvent extends LocalEvent {
    user?: ProfileWithAvatar;
    past: boolean;
}

@Component({
    selector: 'app-upcoming-events-card',
    templateUrl: './upcoming-events-card.html',
    styleUrls: ['./upcoming-events-card.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UpcomingEventsCardComponent implements OnInit, OnDestroy {
    private subscription = Subscription.EMPTY;

    events: DisplayEvent[] = [];
    showAll = false;

    trackEvent: TrackByFunction<LocalEvent> = (_: number, event: LocalEvent) => event._id;

    @Input()
    set highlightUser(s: string) {
        this._highlightUser = s;
        this.changeDetectorRef.markForCheck();
    }
    get highlightUser() { return this._highlightUser; }
    private _highlightUser: string = '';

    private reload = new BehaviorSubject<void>(undefined);

    constructor(
        private calendarapi: CalendarAPI,
        private userService: UserService,
        private changeDetectorRef: ChangeDetectorRef,
    ) { }

    ngOnInit() {
        this.subscription = new Subscription();

        let events = combineLatest([
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

                        if (a._id > b._id) return 1;
                        return -1;
                    })
                    .map(event => ({
                        ...event,
                        past: event.startTime.getTime() < now,
                        user: this.userService.byName(event.username),
                    }));
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
