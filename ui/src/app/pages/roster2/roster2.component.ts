import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from "@angular/core";
import { NzCalendarMode } from "ng-zorro-antd/calendar";
import { UserService } from "src/app/api";
import { RosterShiftWithStaffList, WorkShift } from "src/app/api/roster2";
import { HeaderTitleService } from 'src/app/shared/header-title';
import { ProfileWithAvatar } from './../../../../dist/tkd/api/lib/account/account.types.d';
import { Roster2Service } from './../../api/roster2/roster2.service';

@Component({
  selector: 'tkd-roster2',
  templateUrl: './roster2.html',
  styleUrls: ['./roster2.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TkdRoster2Component implements OnInit {
  private selectedDate!: Date;

  requiredShifts: {
    [date: string]: RosterShiftWithStaffList[]
  } = {};

  users: {[name: string]: ProfileWithAvatar } =  {}

  shiftDefinitions: {[key: string]: WorkShift} = {}

  constructor(
    private roster2: Roster2Service,
    private usersService: UserService,
    private header: HeaderTitleService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.header.set(
      'Dienstplan',
      'Dienstplan bearbeiten',
      null,
      [{name: 'Zurück', route: '/'}]
    )

    this.setSelectedDate(new Date())

    this.roster2.workShifts
      .list()
      .subscribe(result => {
        this.shiftDefinitions =  {};
        result.forEach(shift => this.shiftDefinitions[shift.id] = shift);
        this.cdr.markForCheck();
      })

    this.usersService.users
      // FIXME(unsub)
      .subscribe(users => {
        this.users = {};
        users.forEach(u => this.users[u.name] = u);
        this.cdr.markForCheck();
      })

  }

  private setSelectedDate(d: Date) {
    this.selectedDate = d;

    this.roster2.workShifts.findRequiredShifts(d)
      .subscribe(result => {
        this.requiredShifts = result;
        this.cdr.markForCheck();
      })
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
