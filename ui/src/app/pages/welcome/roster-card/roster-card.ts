import { EventEmitter, ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, Output } from '@angular/core';
import { BehaviorSubject, combineLatest, interval, of, Subscription } from 'rxjs';
import { catchError, map, mergeMap, startWith } from 'rxjs/operators';
import { CalendarAPI, Day, LocalEvent, ProfileWithAvatar, Roster, RosterAPI, UserService } from 'src/app/api';

@Component({
  selector: 'app-roster-card',
  templateUrl: './roster-card.html',
  styleUrls: ['./roster-card.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RosterCardComponent implements OnInit, OnDestroy {
  private subscriptions = Subscription.EMPTY;

  forenoon: ProfileWithAvatar[] = [];
  afternoon: ProfileWithAvatar[] = [];
  onCallDay: ProfileWithAvatar[] = [];
  onCallNight: ProfileWithAvatar[] = [];

  onCallIsSame = true;

  eventsPerUser = new Map<string, LocalEvent[]>();

  @Output()
  userHover = new EventEmitter<string>();

  constructor(
    private rosterapi: RosterAPI,
    private userService: UserService,
    private changeDetector: ChangeDetectorRef,
    private calendarapi: CalendarAPI,
  ) { }

  ngOnInit(): void {
    const triggerReload = new BehaviorSubject<void>(undefined);

    this.subscriptions = new Subscription();

    const rosterSubscription = combineLatest([
      interval(10000),
      triggerReload,
    ])
      .pipe(
        startWith(-1),
        mergeMap(() => {
          const now = new Date();
          return this.rosterapi.forMonth(now.getFullYear(), now.getMonth() + 1);
        }),
        catchError(err => {
          return of(null);
        }),
        map((roster: Roster | null) => {
          if (!roster) {
            return null;
          }
          return roster.days[new Date().getDate()] || null;
        })
      )
      .subscribe((day: Day | null) => {
        this.forenoon = (day?.forenoon || []).map(user => this.userService.byName(user));
        this.afternoon = (day?.afternoon || []).map(user => this.userService.byName(user));
        this.onCallDay = (day?.onCall.day || []).map(user => this.userService.byName(user));
        this.onCallNight = (day?.onCall.night || []).map(user => this.userService.byName(user));

        // FIXME(ppacher): make this a bit more obvious
        if (this.onCallDay.length === 0) {
          this.onCallDay = this.onCallNight;
        }
        this.onCallIsSame = JSON.stringify(this.onCallNight) == JSON.stringify(this.onCallDay);

        this.changeDetector.markForCheck();

        const users = new Set([
          ...this.forenoon,
          ...this.afternoon,
          ...this.onCallDay,
          ...this.onCallNight,
        ].filter(user => !!user.calendarID).map(u => u.name));
        this.calendarapi.listEvents(null, Array.from(users))
          .subscribe({
            next: events => {
              this.eventsPerUser.clear();
              events.forEach(event => {
                if (!!event.username) {
                  const userEvents = this.eventsPerUser.get(event.username) || [];
                  userEvents.push(event);
                  this.eventsPerUser.set(event.username, userEvents);
                }
              });

              this.changeDetector.markForCheck();
            },
            error: err => {
              console.error(err);
            }
          });

      });

    this.subscriptions.add(rosterSubscription);
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }
}
