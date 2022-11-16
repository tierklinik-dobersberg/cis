import { animate, style, transition, trigger } from '@angular/animations';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  TemplateRef,
  TrackByFunction,
  ViewChild
} from '@angular/core';
import { ProfileWithAvatar, TkdAccountService } from '@tkd/api';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';
import {
  BehaviorSubject,
  combineLatest,
  forkJoin,
  interval,
  Observable,
  of,
  OperatorFunction,
  Subject
} from 'rxjs';
import {
  catchError,
  debounceTime,
  filter,
  map, startWith,
  switchMap,
  takeUntil
} from 'rxjs/operators';
import {
  ConfigAPI,
  DoctorOnDutyResponse,
  ExternalAPI, Overwrite,
  OverwriteBody,
  QuickRosterOverwrite,
  RosterAPI, UserService
} from 'src/app/api';
import { RosterShift, RosterShiftWithStaffList } from 'src/app/api/roster2';
import { HeaderTitleService } from 'src/app/shared/header-title';
import { extractErrorMessage, toDateString } from 'src/app/utils';
import { Roster2Service } from './../../../api/roster2/roster2.service';

/**
 * FIXME:
 *  - do not allow datepicker to select in the past
 *  - use correct date for "today" as it might depend on the current datetime (previous night shift).
 *  - strange behavior when no roster is defined
 *  - wrong overwrites returned ("to" should not be inclusive)
 */

interface _DoctorOnDuty extends DoctorOnDutyResponse<Date> {
  users: ProfileWithAvatar[];
}

interface RosterState {
  actual: Overwrite;
  actualUser?: ProfileWithAvatar;
  onDuty: _DoctorOnDuty;
  shifts: RosterShift[];
}

interface _Overwrite extends Overwrite {
  user?: ProfileWithAvatar;
}

@Component({
  templateUrl: './roster-overwrite.html',
  styleUrls: ['./roster-overwrite.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('scaleInOut', [
      transition(':enter', [
        style({ maxHeight: '0', opacity: 0 }),
        animate('200ms', style({ maxHeight: '1000px', opacity: 1 })),
      ]),
      transition(':leave', [
        style({ maxHeight: '1000px', opacity: 1 }),
        animate('200ms', style({ maxHeight: 0, opacity: 0 })),
      ]),
    ]),
  ],
})
export class RosterOverwritePageComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private checkOverlapping$ = new Subject<{ to: Date; from: Date }>();
  private reloadToday$ = new BehaviorSubject<void>(undefined);

  @ViewChild('confirmDeleteCurrentOverwrite', {
    read: TemplateRef,
    static: true,
  })
  confirmDeleteCurrentOverwriteTemplate: TemplateRef<any> | null = null;

  /** A list of overwrites that overlap with the current one */
  overlapping: _Overwrite[] = [];

  /** The currently active overwrite, if any */
  today: RosterState | null = null;

  /** Holds the roster states for the date date */
  statesForRange: RosterState[] | null = null;

  /** A list of users that are preferable used as overwrites */
  preferredUsers: ProfileWithAvatar[] = [];

  /** A list of other users that can be used as overwrites */
  allUsers: ProfileWithAvatar[] = [];

  /** Whether or not all users should be shown */
  showAllUsers = false;

  /** The name of the user that has been selected */
  selectedUser = '';

  /** The selected quick roster overwrite */
  selectedQuickTargetNumber = '';

  /** The time at which the overwrite should be effective */
  from: Date | null = null;

  /** The time until the overwrite should be effective */
  to: Date | null = null;

  /** The type of overwrite that is being created */
  overwriteType: string | 'custom' = '';

  /** A list of configured quick-settings  */
  quickSettings: QuickRosterOverwrite[];

  /** Whether or not direct phone-number overwrites are allowed */
  allowPhone = false;

  /** The custom phone number entered by the user if allowPhone is true */
  customPhoneNumber = '';

  /** The actual time boundary based on the overwriteType */
  actualBoundary: { from: Date; to: Date } | null = null;

  /** Whether or not we're in "firstLoad" mode and should hide the overlapping warning */
  firstLoad = true;

  /** Evaluates to true if everything is ready to create a new roster overwrite */
  get valid(): boolean {
    const valid =
      this.overwriteType != '' &&
      (!!this.selectedUser ||
        !!this.selectedQuickTargetNumber ||
        !!this.customPhoneNumber) &&
      !!this.from &&
      !!this.to;
    if (!valid) {
      return false;
    }
    if (this.overwriteType === 'custom') {
      return this.to.getTime() > this.from.getTime();
    }
    return true;
  }

  /** @private template-only - Returns true if d is before the current roster date */
  isBeforeRosterDate = (d: Date): boolean => {
    if (!d) {
      return false;
    }
    const now = new Date();
    let rosterDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (!!this.today?.onDuty && !!this.today.onDuty.rosterDate) {
      rosterDate = new Date(this.today.onDuty.rosterDate);
      rosterDate = new Date(
        rosterDate.getFullYear(),
        rosterDate.getMonth(),
        rosterDate.getDate()
      );
    }

    return d.getTime() < rosterDate.getTime();
  };

  /** @private template-only - decided whether or not startValue should be displayed as disabled. */
  disabledStartDate = (startValue: Date): boolean => {
    if (!startValue) {
      return false;
    }

    if (this.isBeforeRosterDate(startValue)) {
      return true;
    }

    const { to } = this.actualBoundary;
    if (!to) {
      return false;
    }
    return startValue.getTime() > to.getTime();
  };

  /** @private template-only - decided whether or not endValue should be displayed as disabled. */
  disabledEndDate = (endValue: Date): boolean => {
    if (!endValue) {
      return false;
    }

    const { from } = this.actualBoundary;
    if (this.isBeforeRosterDate(endValue)) {
      return true;
    }

    if (endValue.getTime() < new Date().getTime()) {
      return true;
    }
    if (!from) {
      return false;
    }
    return endValue.getTime() < from.getTime();
  };

  /** TrackBy function for user profiles */
  readonly trackProfile: TrackByFunction<ProfileWithAvatar> = (
    _: number,
    p: ProfileWithAvatar
  ) => p.name;

  /** TrackBy function for quick settings */
  readonly trackQuickSetting: TrackByFunction<QuickRosterOverwrite> = (
    _: number,
    s: QuickRosterOverwrite
  ) => s.TargetNumber;

  constructor(
    private roster: RosterAPI,
    private roster2: Roster2Service,
    private externalapi: ExternalAPI,
    private userService: UserService,
    private account: TkdAccountService,
    private config: ConfigAPI,
    private cdr: ChangeDetectorRef,
    private modal: NzModalService,
    private nzMessage: NzMessageService,
    private header: HeaderTitleService
  ) {}

  onDateChange(humanInteraction = true) {
    if (humanInteraction) {
      this.firstLoad = false;
    }
    if (!this.from) {
      return;
    }
    if (this.overwriteType !== 'custom') {
      this.to = this.from;
    }
    this.checkOverlapping$.next({ from: this.from, to: this.to });
  }

  /** @private template-only - select the user that should be used for the new overwrite */
  selectUser(u: string) {
    this.selectedUser = u;
    this.selectedQuickTargetNumber = '';
    this.customPhoneNumber = '';
  }

  /** @private template-only - selects the quick roster overwrite that should be used */
  selectQuickSetting(s: QuickRosterOverwrite) {
    this.selectedUser = '';
    this.selectedQuickTargetNumber = s.TargetNumber;
    this.customPhoneNumber = '';
  }

  /** @private template-only - called when the user enters a customer phone number */
  onCustomPhoneNumberChange() {
    this.selectedUser = '';
    this.selectedQuickTargetNumber = '';
  }

  /** @private template-only - creates a new roster overwrite */
  createOverwrite() {
    if (!this.valid) {
      return;
    }

    const { from, to } = this.getTimeBoundary(this.statesForRange);
    let body: OverwriteBody = {
      from: from.toISOString(),
      to: to.toISOString(),
    };

    if (!!this.selectedQuickTargetNumber) {
      const s = this.quickSettings.find(
        (q) => q.TargetNumber === this.selectedQuickTargetNumber
      );
      if (!s) {
        this.selectedQuickTargetNumber = '';
        // TODO(ppacher): display error message
        return;
      }
      body.displayName = s.DisplayName;
      body.phoneNumber = s.TargetNumber;
    }
    if (!!this.customPhoneNumber) {
      body.phoneNumber = this.customPhoneNumber;
      body.displayName = this.customPhoneNumber;
    }

    let target = body.displayName || '';
    if (!!this.selectedUser) {
      body.username = this.selectedUser;
      target = this.userService.byName(this.selectedUser)?.fullname;
    }

    this.roster.setOverwrite(body).subscribe(
      () => {
        this.nzMessage.success(`Telefon erfolgreich auf ${target} umgeleitet.`);
        this.reloadToday$.next();
        this.firstLoad = true;
        this.overwriteType = '';
        this.statesForRange = [];
        this.actualBoundary = null;
        this.checkOverlapping$.next({ from, to });
      },
      (err) => {
        this.firstLoad = false;
        this.nzMessage.error(
          extractErrorMessage(err, 'Telefon konnte nicht umgeleitet werden')
        );
        this.cdr.markForCheck();
      }
    );
  }

  /** @private template-only - deletes the current overwrite */
  deleteCurrentOverwrite() {
    if (!this.today?.actual || !this.confirmDeleteCurrentOverwriteTemplate) {
      return;
    }

    this.modal.confirm({
      nzTitle: 'Umleitung zurücksetzten?',
      nzContent: this.confirmDeleteCurrentOverwriteTemplate,
      nzCancelText: 'Nein',
      nzOkText: 'Ja, löschen',
      nzOnOk: () => {
        this.deleteOverwrite(this.today.actual);
      },
    });
  }

  /** @private template-only - deletes a overwrite by ID */
  deleteOverwrite(ov: Overwrite) {
    if (!ov || !ov._id) {
      return;
    }

    this.roster.deleteOverwriteById(ov).subscribe(
      () => {
        this.nzMessage.success('Eintrag wurde erfolgreich gelöscht');
        this.onDateChange();
        this.reloadToday$.next();
      },
      (err) =>
        this.nzMessage.error(
          extractErrorMessage(err, 'Eintrag konnte nicht gelöscht werden')
        )
    );
  }

  selectTime(what: 'from' | 'to') {
    let d: Date;
    if (what === 'from') {
      d = this.from;
    } else {
      d = this.to;
    }

    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate())
    const end = new Date(d.getFullYear(), d.getMonth(), d.getDate()+1)

    this.roster2
      .workShifts
      .findRequiredShifts(start, end, ["OnCall"])
      .subscribe({
        next: (shifts) => {
          let nd: RosterShiftWithStaffList = shifts[toDateString(d)]?.pop();

          if (!!nd) {
            if (what === 'from') {
              this.from = new Date(nd.from);
            } else {
              this.to = new Date(nd.to);
            }

            this.preferredUsers = nd.eligibleStaff
              .map(user => this.userService.byName(user));
          }

          this.cdr.markForCheck();
        },
      });
  }

  ngOnInit() {
    this.destroy$ = new Subject();

    this.header.set(
      'Telefon Umleitungen',
      'Überschreibe den Dienstplan und wähle ein neues Ziel für Anrufe außerhalb der Öffnungszeiten'
    );

    // load and watch preferred and other allowed users.
    const rosterConfig$ = this.config.change;
    combineLatest([rosterConfig$, this.userService.users])
      .pipe(
        takeUntil(this.destroy$)
      )
      .subscribe(([c, users]) => {
        let currentUserRoles = new Set<string>();
        this.account.currentProfile?.roles.forEach(role => {
          currentUserRoles.add(role)
        })

        this.quickSettings = (c.QuickRosterOverwrite || []).filter(setting => {
          return !setting.RequiresRole || setting.RequiresRole.length === 0 || setting.RequiresRole.some(role => currentUserRoles.has(role));
        });

        this.allUsers = users;
        this.allowPhone = c.Roster?.AllowPhoneNumberOverwrite || false;
        this.cdr.markForCheck();
      });

    // load and watch the currently active overwrite for this day
    combineLatest([interval(5000).pipe(startWith(-1)), this.reloadToday$])
      .pipe(
        map(() => new Date()),
        this.toRosterState(),
        takeUntil(this.destroy$)
      )
      .subscribe((active: RosterState) => {
        if (!!active.actual?.username) {
          active.actualUser = this.userService.byName(active.actual.username);
        }
        this.today = active;

        // if the overwriteType is not yet set and we don't have an active overwrite we try to
        // figure out a reasonable default
        if (this.overwriteType === '' && !this.today.actual) {
          this.from = new Date();
          this.overwriteType = 'both';

          this.onDateChange(false);
        }

        this.cdr.markForCheck();
      });

    // check for overlapping overwrites.
    this.checkOverlapping$
      .pipe(
        takeUntil(this.destroy$),
        debounceTime(100),
        filter(() => this.overwriteType != ''),
        switchMap((value) => {
          let iter: Date = this.from;
          let states: Observable<RosterState>[] = [];

          do {
            states.push(
              of(iter).pipe(this.toRosterState(), takeUntil(this.destroy$))
            );
            iter = new Date(
              iter.getFullYear(),
              iter.getMonth(),
              iter.getDate() + 1
            );
          } while (iter.getTime() < this.to.getTime());
          return forkJoin(states);
        }),
        switchMap((states) => {
          const timeBoundary = this.getTimeBoundary(states);
          return forkJoin({
            states: of(states),
            overlapping: this.roster
              .getOverwrites(timeBoundary.from, timeBoundary.to)
              .pipe(
                map((res) => {
                  return (res || []).map((ov) => ({
                    ...ov,
                    user: !!ov.username
                      ? this.userService.byName(ov.username)
                      : null,
                  }));
                }),
                catchError((err) => {
                  if (
                    !(err instanceof HttpErrorResponse) ||
                    err.status !== 404
                  ) {
                    console.error(err);
                  }
                  return of([]);
                })
              ),
          });
        })
      )
      .subscribe((state) => {
        this.statesForRange = state.states;
        this.overlapping = state.overlapping;
        this.actualBoundary = this.getTimeBoundary(state.states);
        this.cdr.markForCheck();
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.reloadToday$.complete();
  }

  /**
   * Returns a list of user profiles that match the given term.
   * If term is an empty string, all preferred users are returned.
   *
   * @param term The search term to filter users
   */
  filterUsers(term: string): ProfileWithAvatar[] {
    if (term === '') {
      return this.preferredUsers;
    }

    const result: ProfileWithAvatar[] = [];
    const matchUser = (u: ProfileWithAvatar) => {
      if (u.name.includes(term) || u.fullname.includes(term)) {
        result.push(u);
      }
    };

    this.preferredUsers.forEach(matchUser);
    this.allUsers.forEach(matchUser);
    return result;
  }

  private getTimeBoundary(states: RosterState[]): { from: Date; to: Date } {
    if (this.overwriteType === 'custom') {
      return {
        from: this.from || null,
        to: this.to || null,
      };
    }
    if (states.length === 0) {
      console.log(
        `[DEBUG] no time boundary available for overwriteType != custom and empty states`
      );
      return null;
    }

    // we should not receive more than one state if the overwrite type is set to anything other
    // than "custom".
    const shift = states[0].shifts.find(shift => shift.shiftID === this.overwriteType)
    if (!shift) {
      return null;
    }

    return { from: new Date(shift.from), to: new Date(shift.to) };
  }

  private toRosterState(): OperatorFunction<Date, RosterState> {
    return (src: Observable<Date>) => {
      return src.pipe(
        switchMap((d) => {
          if (d === null) {
            return of(null);
          }

          return forkJoin({
            actual: this.roster.getActiveOverwrite(d).pipe(
              catchError((err) => {
                if (!(err instanceof HttpErrorResponse) || err.status !== 404) {
                  console.error(`Failed to get active overwrite`, err);
                }
                return of(null as Overwrite | null);
              })
            ),
            onDuty: this.externalapi
              .getDoctorsOnDuty({ at: d, ignoreOverwrite: true })
              .pipe(
                map((dod) => {
                  if (dod.isOverwrite) {
                    console.error(
                      'Got an overwrite response although we told the API not to'
                    );
                  }
                  return {
                    ...dod,
                    users: dod.doctors.map((d) =>
                      this.userService.byName(d.username)
                    ),
                  } as _DoctorOnDuty;
                }),
                catchError((err) => {
                  return of(null as _DoctorOnDuty);
                })
              ),
            shifts: this.roster2
                .roster
                .onDuty({
                  tags: ['OnCall'],
                  date: d,
                })
                .pipe(
                  map(r => r.shifts),
                  catchError(err => {
                    if (err instanceof HttpErrorResponse && err.status === 404) {
                      return this.roster2
                              .workShifts
                              .findRequiredShifts(
                               new Date(d.getFullYear(), d.getMonth(), d.getDate()),
                               new Date(d.getFullYear(), d.getMonth(), d.getDate() +1),
                              )
                              .pipe(
                                map(res => res[toDateString(d)])
                              )
                    }
                  })
                )
          });
        }),
        map((result) => {
          if (result === null) {
            return null;
          }
          return {
            ...result,
            shifts: result.shifts,
          };
        })
      );
    };
  }
}
