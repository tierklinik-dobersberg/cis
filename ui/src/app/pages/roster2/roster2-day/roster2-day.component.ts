import { ChangeDetectionStrategy, Component, Input, OnChanges, SimpleChanges } from "@angular/core";
import { WorkShift } from 'src/app/api/roster2';
import { ProfileWithAvatar } from './../../../../../dist/tkd/api/lib/account/account.types.d';
import { RosterShiftWithStaffList } from './../../../api/roster2/roster2-types';

@Component({
  selector: 'tkd-roster2-day',
  templateUrl: './roster2-day.html',
  changeDetection:ChangeDetectionStrategy.OnPush,
  styles: [
    `
    :host {
      display: flex;
      flex-direction: column;
      height: 200px;
      overflow: hidden;
    }
    `
  ]
})
export class TkdRoster2DayComponent implements OnChanges {
  @Input()
  date!: Date;

  @Input()
  requiredShifts: RosterShiftWithStaffList[] = [];

  @Input()
  shiftDefinitions: {[key: string]: WorkShift} = {}

  @Input()
  users: {[key: string]: ProfileWithAvatar} = {};

  assigned: {
    [id: string]: string[]
  } = {};

  ngOnChanges(changes: SimpleChanges) {
    if (!('requiredShifts' in changes)) {
      return
    }
  }
}
