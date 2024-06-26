import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, OnDestroy, OnInit, Output, inject } from '@angular/core';
import { Timestamp } from '@bufbuild/protobuf';
import { GetRosterResponse, GetWorkingStaffResponse, ListWorkShiftsResponse, PlannedShift, Profile, WorkShift } from '@tierklinik-dobersberg/apis';
import { BehaviorSubject, Subscription, combineLatest, forkJoin, interval } from 'rxjs';
import { mergeMap, startWith } from 'rxjs/operators';
import { ConfigAPI, UserService } from 'src/app/api';
import { ROSTER_SERVICE, WORK_SHIFT_SERVICE } from 'src/app/api/connect_clients';
import { toDateString } from 'src/app/utils';

@Component({
  selector: 'app-roster-card',
  templateUrl: './roster-card.html',
  styleUrls: ['./roster-card.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RosterCardComponent implements OnInit, OnDestroy {
  private subscriptions = Subscription.EMPTY;

  shifts: (PlannedShift & {definition: WorkShift})[] = [];
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

  private rosterService = inject(ROSTER_SERVICE)
  private workShiftService = inject(WORK_SHIFT_SERVICE);
  private config = inject(ConfigAPI);

  constructor(
    private userService: UserService,
    private changeDetector: ChangeDetectorRef,
  ) { }

  ngOnInit(): void {
    const triggerReload = new BehaviorSubject<void>(undefined);

    this.subscriptions = new Subscription();

    const rosterSubscription = combineLatest([
      interval(5 * 60 * 1000),
      triggerReload,
    ])
      .pipe(
        startWith(-1),

        mergeMap(() => forkJoin({
          staff: this.rosterService.getRoster({
            search: {
              case: 'date',
              value: Timestamp.fromDate(new Date()),
            },
            readMask: {
              paths: ['roster']
            }
          }).catch(err => new GetRosterResponse()),

          shifts: this.workShiftService.listWorkShifts({})
            .catch(() => new ListWorkShiftsResponse())
        })),
      )
      .subscribe((response) => {
        const now = toDateString(new Date());
        if (!response.staff.roster?.length) {
          this.shifts = [];
          this.changeDetector.markForCheck();

          return
        }

        this.shifts = response.staff.roster[0]?.shifts
          .filter(shift => {
            const from = shift.from.toDate()
            return toDateString(from) === now;
          })
          .map(shift => {
            const definition = response.shifts.workShifts.find(ws => ws.id === shift.workShiftId)
            if (!!definition) {
              Object.defineProperty(shift, 'definition', {
                get: () => definition
              })
            }

            return shift;
          }) as typeof this['shifts']

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
