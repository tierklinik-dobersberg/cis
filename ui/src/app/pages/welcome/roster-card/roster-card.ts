import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, OnDestroy, OnInit, Output } from '@angular/core';
import { Profile } from '@tkd/apis';
import { BehaviorSubject, Subscription, combineLatest, interval, of } from 'rxjs';
import { catchError, mergeMap, startWith } from 'rxjs/operators';
import { UserService } from 'src/app/api';
import { Roster2Service, RosterShift } from 'src/app/api/roster2';

@Component({
  selector: 'app-roster-card',
  templateUrl: './roster-card.html',
  styleUrls: ['./roster-card.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RosterCardComponent implements OnInit, OnDestroy {
  private subscriptions = Subscription.EMPTY;

  shifts: RosterShift[] = [];
  profiles: {
    [key: string]: Profile
  } = {}

  @Output()
  userHover = new EventEmitter<string>();

  @Output()
  userClick = new EventEmitter<string>();
  private _lastUserClick = '';

  userClicked(user: string) {
    if (this._lastUserClick === user) {
      this.userClick.next('');
      this._lastUserClick = '';
      return
    }

    this.userClick.next(user);
    this._lastUserClick = user;
  }

  constructor(
    private roster2: Roster2Service,
    private userService: UserService,
    private changeDetector: ChangeDetectorRef,
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
          return this.roster2.roster.onDuty({date: new Date()})
        }),
        catchError(err => {
          return of({shifts: []});
        }),
      )
      .subscribe((response) => {
        this.shifts = response.shifts;
        this.changeDetector.markForCheck();

      });

    this.subscriptions.add(rosterSubscription);

    const userSub =this.userService.users
      .subscribe(users => {
        this.profiles = {};
        users.forEach(u => this.profiles[u.user.id] = u);
        this.changeDetector.markForCheck();
      });

    this.subscriptions.add(userSub);
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }
}
