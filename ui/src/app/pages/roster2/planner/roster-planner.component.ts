import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { Profile } from '@tkd/apis';
import { NzCalendarMode } from "ng-zorro-antd/calendar";
import { NzMessageRef, NzMessageService } from 'ng-zorro-antd/message';
import { Observable, of } from 'rxjs';
import { Subject } from "rxjs/internal/Subject";
import { catchError, debounceTime, map, switchMap, takeUntil } from "rxjs/operators";
import { Holiday, HolidayAPI, UserService } from "src/app/api";
import { OffTime, RosterShift, RosterShiftWithStaffList, WorkTimeStatus } from "src/app/api/roster2";
import { HeaderTitleService } from 'src/app/shared/header-title';
import { extractErrorMessage, toDateString } from 'src/app/utils';
import { ConstraintViolationDiagnostics, Roster } from '../../../api/roster2/roster2-types';
import { Roster2Service } from '../../../api/roster2/roster2.service';

@Component({
  selector: 'tkd-roster-planner',
  templateUrl: './roster-planner.html',
  styleUrls: ['./roster-planner.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TkdRosterPlannerComponent implements OnInit, OnDestroy {
  private analyze$ = new Subject<void>();
  private destroy$ = new Subject<void>();

  selectedDate!: Date;

  allEligibleUsers: string[] = [];

  requiredShifts: {
    [date: string]: RosterShiftWithStaffList[]
  } = {};

  profiles: {[name: string]: Profile} =  {}

  rosterShifts: {
    [date: string]: RosterShift[];
  } = {};

  selectedUser: string | null = null;

  highlightUserShifts: string | null = null;

  publicHolidays: {
    [date: string]: Holiday;
  } = {}

  workTimeStatus: {
    [username: string]: WorkTimeStatus
  } = {};

  offTimeRequests: {
    [id: string]: OffTime.Entry
  } = {}

  perUserDiagnostics: {
    [key: string]: ConstraintViolationDiagnostics[];
  };
  diagCount = 0;

  showRosterDiagnostics = false;

  existingID = '';

  changesCounter = 0;
  savedChangesCounter = 0;

  hasChanges() {
    return this.changesCounter > this.savedChangesCounter;
  }

  private ignoreRouteChange = false;

  private debouncedSave = new Subject<number>();

  dateDisabled = (d: Date) => {
    return d.getMonth() !== this.selectedDate.getMonth();
  }

  constructor(
    private roster2: Roster2Service,
    private usersService: UserService,
    private header: HeaderTitleService,
    private holiday: HolidayAPI,
    private router: Router,
    private currentRoute: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    private nzMessage: NzMessageService,
  ) {}

  setSelectedUser(username: string) {
    if (this.selectedUser === username) {
      this.selectedUser = null;
      return;
    }

    this.selectedUser = username;
  }

  setRosterShifts(date: Date, shifts: RosterShift[]) {
    this.changesCounter++;

    this.rosterShifts[toDateString(date)] = shifts;
    this.cdr.markForCheck();

    this.analyze$.next();
    this.debouncedSave.next(this.changesCounter);
  }

  generate() {
    this.roster2
      .roster
      .generate(this.selectedDate.getFullYear(), this.selectedDate.getMonth()+1)
      .subscribe(result => {
          result.shifts.forEach(shift => {
            const key = toDateString(new Date(shift.from));
            if (!this.rosterShifts[key]) {
              this.rosterShifts[key] = [];
            }

            this.rosterShifts[key].push(shift)
          });

          this.existingID = result.id!;
          this.cdr.markForCheck()
      })
  }

  private getRoster(): Pick<Roster, 'shifts'|'month'|'year'> {
    let allShifts: RosterShift[] = [];
    Object.keys(this.rosterShifts)
      .map(key => this.rosterShifts[key])
      .forEach(shifts => {
        allShifts = [
          ...allShifts,
          ...shifts,
        ]
      })

    return {
      shifts: allShifts,
      month: this.selectedDate.getMonth() + 1,
      year: this.selectedDate.getFullYear()
    }
  }

  saveRoster() {
    const roster = this.getRoster();

    let sub: Observable<void>;
    if (this.existingID) {
      sub = this.roster2.roster
        .update({
          ...roster,
          id: this.existingID,
        })
    } else {
      sub = this.roster2.roster
        .create(roster)
    }

    const counter = this.changesCounter;
    sub.subscribe({
      next: () => {
        if (this.savedChangesCounter < counter) {
          this.savedChangesCounter = counter;
          this.nzMessage.success('Dienstplan wurde gespeichert');
        }
      },
      error: err => {
        this.nzMessage.error(extractErrorMessage(err, 'Dienstplan konnte nicht gespeichert werden'))
      }
    })
  }

  ngOnInit(): void {
    this.header.set(
      'Dienstplan',
      'Dienstplan bearbeiten',
      null,
      [{name: 'Zurück', route: '/roster'}]
    )

    this.currentRoute
      .paramMap
      .pipe(
        takeUntil(this.destroy$),
        map(params => [params.get("year"), params.get("month")]),
      )
      .subscribe(date => {
        if (this.ignoreRouteChange) {
          this.ignoreRouteChange = false
          return
        }

        let d: Date = new Date();
        d = new Date(d.getFullYear(), d.getMonth()+1, 1)

        if (date[0] !== null && date[1] !== null) {
          d = new Date(+date[0], +date[1]-1, 1)
        }

        this.setSelectedDate(d);
      })

    this.analyze$
      .pipe(
        takeUntil(this.destroy$),
        debounceTime(1000),
        switchMap(() => this.roster2.roster.analyze({
          id: '',
          month: this.selectedDate.getMonth() + 1,
          year: this.selectedDate.getFullYear(),
          shifts: Object.keys(this.rosterShifts)
            .map(key => this.rosterShifts[key])
            .reduce((sum, current) => {
              return [
                ...sum,
                ...current
              ]
            }, [] as RosterShift[])
        }))
      )
      .subscribe(result => {
        this.perUserDiagnostics = {};

        result.diagnostics
          .forEach(dia => {
            if (dia.type === 'constraint-violation') {
              this.perUserDiagnostics[dia.details.user] = [
                ...(this.perUserDiagnostics[dia.details.user] || []),
                dia,
              ]
            }
          })

        this.diagCount = result.diagnostics?.length || 0;

        this.workTimeStatus = result.workTime;

        this.cdr.markForCheck();
      })

    this.usersService.users
      .pipe(takeUntil(this.destroy$))
      .subscribe(users => {
        this.profiles = {};
        (users || []).forEach(u => this.profiles[u.user.id] = u);
        this.cdr.markForCheck();
      })

    let saveMessage: NzMessageRef | null = null;
    this.debouncedSave
      .pipe(
        takeUntil(this.destroy$),
        debounceTime(10000),
        switchMap((counter) => {
          if (!this.existingID || !this.hasChanges()) {
            return of(null);
          }

          saveMessage = this.nzMessage.loading('Dienstplan wird gespeichert')

          const roster = {
            ...this.getRoster(),
            id: this.existingID,
          }

          return this.roster2.roster.update(roster)
            .pipe(
              map(() => counter),
              catchError(err => {
                this.nzMessage.error(extractErrorMessage(err, 'Dienstplan konnte nicht gespeichert werden'))

                return of(null)
              })
            )
        })
      )
      .subscribe((res) => {
        if (!!saveMessage) {
          this.nzMessage.remove(saveMessage.messageId);
          saveMessage = null;
        }

        if (res !== null) {
          if (this.savedChangesCounter === this.changesCounter) {
            this.nzMessage.success('Dienstplan wurde gespeichert')
          }
          this.savedChangesCounter = res;
        }
      })
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setSelectedDate(d: Date) {
    this.selectedDate = d;
    this.existingID = '';

    this.roster2.workShifts.findRequiredShifts(d)
      .subscribe(result => {
        this.requiredShifts = result;

        let users = new Set<string>();
        Object.keys(result)
          .map(key => result[key])
          .forEach(list =>
            list.forEach(shift =>
              shift.eligibleStaff.forEach(staff => {
                users.add(staff)
              })
            )
          );

        this.allEligibleUsers = Array.from(users.values())

        this.cdr.markForCheck();
      })

    this.analyze$.next();

    this.holiday.forMonth(d.getFullYear(), d.getMonth()+1)
      .subscribe(holidays => {
        this.publicHolidays = {};
        (holidays || []).forEach(day => {
          this.publicHolidays[day.date] = day;
        })

        this.cdr.markForCheck()
      });

    this.roster2.offTime
      .findRequests(
        undefined,
        new Date(this.selectedDate.getFullYear(), this.selectedDate.getMonth(), 1),
        new Date(this.selectedDate.getFullYear(), this.selectedDate.getMonth()+1, 0),
        true
      )
      .subscribe(offTimes => {
        this.offTimeRequests = {};
        (offTimes || []).forEach(req => {
          this.offTimeRequests[req.id!] = req
        })

        this.cdr.markForCheck();
      })

    this.roster2.roster
      .get(this.selectedDate.getFullYear(), this.selectedDate.getMonth()+1)
      .subscribe({
        next: result => {
          result.shifts.forEach(shift => {
            const key = toDateString(new Date(shift.from));
            if (!this.rosterShifts[key]) {
              this.rosterShifts[key] = [];
            }

            this.rosterShifts[key].push(shift)
          });

          this.existingID = result.id!;
          this.cdr.markForCheck()
        },
        error: err => {
          this.rosterShifts = {};

          if (!(err instanceof HttpErrorResponse) || (err.status !== 404)) {
            this.nzMessage.error(extractErrorMessage(err, 'Dienstplan konnte nicht geladen werden'))
          }
        }
      })

    this.ignoreRouteChange = true
    this.router.navigate(['/roster/plan', this.selectedDate.getFullYear(), this.selectedDate.getMonth()+1])
  }

  /**
   * Callback when the user selected a day in the roster
   */
  onDateSelected(date: Date): void {
    const changed = date.getMonth() !== this.selectedDate.getMonth() || date.getFullYear() !== this.selectedDate.getFullYear();

    if (changed) {
      this.onPanelChange({
        date,
        mode: 'month'
      });
    }
  }

  /**
   * Callback for changes in the date displayed.
   *
   * @param param0 The event emitted
   */
  onPanelChange({ date, mode }: { date: Date, mode: NzCalendarMode }): void {
    if (mode === 'year') {
      return;
    }
    this.setSelectedDate(date);
  }
}
