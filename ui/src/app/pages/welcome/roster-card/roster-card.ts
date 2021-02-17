import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { BehaviorSubject, combineLatest, interval, of, Subscription } from 'rxjs';
import { catchError, map, mergeMap, startWith } from 'rxjs/operators';
import { Day, ProfileWithAvatar, Roster, RosterAPI, UserService } from 'src/app/api';

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
  emergency: ProfileWithAvatar[] = [];

  constructor(
    private rosterapi: RosterAPI,
    private userService: UserService,
    private changeDetector: ChangeDetectorRef,
  ) { }

  ngOnInit() {
    let triggerReload = new BehaviorSubject<void>(undefined);

    this.subscriptions = new Subscription();

    let rosterSubscription = combineLatest([
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
          return roster!.days[new Date().getDate()] || null;
        })
      )
      .subscribe((day: Day | null) => {
        this.forenoon = (day?.forenoon || []).map(user => this.userService.byName(user))
        this.afternoon = (day?.afternoon || []).map(user => this.userService.byName(user))
        this.emergency = (day?.emergency || []).map(user => this.userService.byName(user))
        this.changeDetector.markForCheck();
      })

    this.subscriptions.add(rosterSubscription);
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }
}
