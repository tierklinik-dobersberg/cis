import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { NzCalendarMode } from "ng-zorro-antd/calendar";
import { Subject } from "rxjs/internal/Subject";
import { pipe } from "rxjs/internal/util/pipe";
import { debounceTime, map, mergeMap, startWith, switchMap, takeUntil } from "rxjs/operators";
import { Holiday, HolidayAPI, UserService } from "src/app/api";
import { OffTime, RosterShift, RosterShiftWithStaffList, WorkShift, WorkTimeStatus } from "src/app/api/roster2";
import { HeaderTitleService } from 'src/app/shared/header-title';
import { ProfileWithAvatar } from './../../../../dist/tkd/api/lib/account/account.types.d';
import { Roster2Service } from './../../api/roster2/roster2.service';

@Component({
  selector: 'tkd-roster2',
  templateUrl: './roster2.html',
  styleUrls: ['./roster2.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TkdRoster2Component implements OnInit, OnDestroy {
  private analyze$ = new Subject<void>();
  private destroy$ = new Subject<void>();

  selectedDate!: Date;

  allEligibleUsers: string[] = [];

  requiredShifts: {
    [date: string]: RosterShiftWithStaffList[]
  } = {};

  users: {[name: string]: ProfileWithAvatar } =  {}

  shiftDefinitions: {[key: string]: WorkShift} = {}

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

  private ignoreRouteChange = false;

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
  ) {}

  setSelectedUser(username: string) {
    if (this.selectedUser === username) {
      this.selectedUser = null;
      return;
    }

    this.selectedUser = username;
  }

  setRosterShifts(date: Date, shifts: RosterShift[]) {
    this.rosterShifts[date.toISOString().split('T')[0]] = shifts;
    this.cdr.markForCheck();

    this.analyze$.next();
  }

  ngOnInit(): void {
    this.header.set(
      'Dienstplan',
      'Dienstplan bearbeiten',
      null,
      [{name: 'Zurück', route: '/'}]
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
        this.workTimeStatus = result.workTime;
        this.cdr.markForCheck();
      })

    this.roster2.workShifts
      .list()
      .subscribe(result => {
        this.shiftDefinitions =  {};
        (result || []).forEach(shift => this.shiftDefinitions[shift.id] = shift);
        this.cdr.markForCheck();
      })

    this.usersService.users
      .pipe(takeUntil(this.destroy$))
      .subscribe(users => {
        this.users = {};
        (users || []).forEach(u => this.users[u.name] = u);
        this.cdr.markForCheck();
      })
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setSelectedDate(d: Date) {
    this.selectedDate = d;

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

    this.ignoreRouteChange = true
    this.router.navigate(['/roster2', this.selectedDate.getFullYear(), this.selectedDate.getMonth()+1])
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