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
  interval, of, Subject
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
  ConfigAPI, ExternalAPI, Overwrite,
  OverwriteBody,
  QuickRosterOverwrite,
  RosterAPI, UserService
} from 'src/app/api';
import { RosterShift, RosterShiftWithStaffList } from 'src/app/api/roster2';
import { HeaderTitleService } from 'src/app/shared/header-title';
import { extractErrorMessage, toDateString } from 'src/app/utils';
import { DoctorOnDutyResponse } from './../../../api/external.api';
import { Roster2Service } from './../../../api/roster2/roster2.service';

interface _DoctorOnDuty extends DoctorOnDutyResponse<Date> {
  users: ProfileWithAvatar[];
}

interface RosterState {
  actual: Overwrite;
  actualUser?: ProfileWithAvatar;
  onDuty: _DoctorOnDuty;
  shifts: RosterShift[];
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
  overlapping: Overwrite[] = [];

  /** AvailableShifts holds the available shifts at the selected date */
  availableShifts: RosterShiftWithStaffList[] = [];

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

  /** The time at which the overwrite should be effective when overwriteTarget == 'custom' */
  customFrom: Date | null = null;

  /** The time until the overwrite should be effective when overwriteTarget === 'custom' */
  customTo: Date | null = null;

  /** The currently active overwrite, if any */
  currentOverwrite: Overwrite | null = null;

  /** The current doctor on duty */
  currentRoster: DoctorOnDutyResponse | null = null;

  /** The type of overwrite that is being created */
  overwriteTarget: string | 'custom' = '';

  /** A list of configured quick-settings  */
  quickSettings: QuickRosterOverwrite[];

  /** Whether or not direct phone-number overwrites are allowed */
  allowPhone = false;

  /** The custom phone number entered by the user if allowPhone is true */
  customPhoneNumber = '';

  /** Whether or not we're in "firstLoad" mode and should hide the overlapping warning */
  firstLoad = true;

  /** Evaluates to true if everything is ready to create a new roster overwrite */
  get valid(): boolean {
    // FIXME
    return true;
  }

  /** @private template-only - Returns true if d is before the current roster date */
  isBeforeRosterDate = (d: Date): boolean => {
    if (!d) {
      return false;
    }
    const now = new Date();
    let rosterDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    return d.getTime() < rosterDate.getTime();
  };

  /** @private template-only - decided whether or not startValue should be displayed as disabled. */
  disabledStartDate = (startValue: Date): boolean => {
    // FIXME
    return false
  };

  /** @private template-only - decided whether or not endValue should be displayed as disabled. */
  disabledEndDate = (endValue: Date): boolean => {
    // FIXME
    return false
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

    let from: Date;
    let to: Date;

    if (this.overwriteTarget === 'custom') {
      // FIXME(ppacher): we need to reload the available shifts now
      from = this.customFrom;
      to = this.customTo;
    } else {
      from = new Date(this.customFrom)
      to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1)
    }

    // customTo is not set so better bail out if one of them is
    // currently invalid/unset
    if (!from || !to) {
      return;
    }

    this.roster2
      .workShifts
      .findRequiredShifts(from, to, ['OnCall'], true)
      .subscribe(shifts => {
        this.availableShifts = shifts[toDateString(from)] || [];

          // get a list of all eligible users for the available shifts.
          let set = new Map<string, ProfileWithAvatar>();
          this.availableShifts.forEach(shift =>
            shift.eligibleStaff.forEach(staff => {
              set.set(staff, this.userService.byName(staff))
            }))

          // actually get the preferred users.
          this.preferredUsers = Array.from(set.values())
            .sort((a, b) => {
              if (a.name > b.name) {
                return 1;
              }

              if (a.name < b.name) {
                return -1
              }
              return 0
          })

        // we just changed the date so the currently selected shift to overwrite
        // might not be available anymore. Better update the overwriteTarget
        // to either the first shift available or set it to "custom".
        if (this.overwriteTarget !== 'custom') {


          if (this.availableShifts.length > 0) {
            this.overwriteTarget = this.availableShifts[0].shiftID;
          } else {
            this.overwriteTarget = 'custom';
          }
        }

        this.cdr.markForCheck();
      })

    this.checkOverlapping$.next({ from, to });
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

    const { from, to } = this.getTimeBoundary();
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
        this.overwriteTarget = '';
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
    if (!this.currentOverwrite || !this.confirmDeleteCurrentOverwriteTemplate) {
      return;
    }

    this.modal.confirm({
      nzTitle: 'Umleitung zurücksetzten?',
      nzContent: this.confirmDeleteCurrentOverwriteTemplate,
      nzCancelText: 'Nein',
      nzOkText: 'Ja, löschen',
      nzOnOk: () => {
        this.deleteOverwrite(this.currentOverwrite);
      },
    });
  }

  get actualBoundary(): { to: Date, from: Date } {
    return this.getTimeBoundary();
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
        switchMap(d => forkJoin({
          currentOverwrite: this.roster.getActiveOverwrite(d)
            .pipe(
              catchError(err => {
                return of(null)
              }),
            ),
          currentlyActiveRoster: this.externalapi
              .getDoctorsOnDuty({at: d, ignoreOverwrite: true})
        })),
        takeUntil(this.destroy$),
      )
      .subscribe(result => {
        this.currentOverwrite = result.currentOverwrite;
        this.currentRoster = result.currentlyActiveRoster;

        this.cdr.markForCheck();
      });

    // check for overlapping overwrites.
    this.checkOverlapping$
      .pipe(
        takeUntil(this.destroy$),
        debounceTime(100),
        filter(() => this.overwriteTarget != ''),
        switchMap(({from, to}) => {
          return forkJoin({
            overlapping: this.roster
              .getOverwrites(from, to)
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
        this.overlapping = state.overlapping;
        this.cdr.markForCheck();
      });

    this.customFrom = new Date();
    this.onDateChange(false)
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

  private getTimeBoundary(): { from: Date; to: Date } {
    if (this.overwriteTarget === 'custom') {
      return {
        from: this.customFrom,
        to: this.customTo
      }
    }

    const shift = this.availableShifts.find(s => s.shiftID === this.overwriteTarget);
    if (!shift) {
      debugger;

      return
    }

    return {
      from: new Date(shift.from),
      to: new Date(shift.to)
    }
  }
}
