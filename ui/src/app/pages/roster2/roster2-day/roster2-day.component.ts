import { CdkOverlayOrigin } from "@angular/cdk/overlay";
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from "@angular/core";
import { NzModalService } from "ng-zorro-antd/modal";
import { Holiday } from "src/app/api";
import { WorkShift } from 'src/app/api/roster2';
import { TkdConstraintViolationPipe } from "../constraint-violation-text.pipe";
import { ProfileWithAvatar } from './../../../../../dist/tkd/api/lib/account/account.types.d';
import { OffTime, RosterShift, RosterShiftWithStaffList, WorkTimeStatus } from './../../../api/roster2/roster2-types';

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
  ],
})
export class TkdRoster2DayComponent implements OnChanges {
  @Input()
  date!: Date;

  @Input()
  rosterDate: Date;

  @Input()
  requiredShifts: RosterShiftWithStaffList[] = [];

  @Input()
  shiftDefinitions: {[key: string]: WorkShift} = {}

  @Input()
  users: {[key: string]: ProfileWithAvatar} = {};

  @Input()
  selectedUser: string | null = null;

  @Input()
  holiday?: Holiday;

  @Input()
  highlightUserShifts: string | null = null;

  @Input()
  offTimeRequest: {[id: string]: OffTime.Entry} = {}

  @Input()
  workTimeStatus: {[user: string]: WorkTimeStatus} = {}

  assigned: {
    [id: string]: Set<string>
  } = {};

  @Output()
  rosterShiftChange = new EventEmitter<RosterShift[]>();

  @Input()
  rosterShifts?: RosterShift[];

  get isDisabledDate() {
    return this.date.getMonth() !== this.rosterDate.getMonth();
  }

  constructor(
    private nzModal: NzModalService,
    private cdr: ChangeDetectorRef
  ) {}

  onShiftClick(trigger: CdkOverlayOrigin, shift: RosterShiftWithStaffList, user = this.selectedUser) {
    if (!!user) {
      let set = this.assigned[shift.shiftID] || new Set();
      let assign = () => {
        this.assigned[shift.shiftID] = set

        if (set.has(user)) {
          set.delete(user);
        } else {
          set.add(user)
        }

        // for CD, we need to make new instances of all sets
        // so the inList pipe will get fired again.
        let newAssigned = {};
        Object.keys(this.assigned).forEach(key => {
          newAssigned[key] = new Set(this.assigned[key].values())
        })
        this.assigned = newAssigned;

        this.cdr.markForCheck();
        this.publishRosterShift();
      }

      let confirmMessage: any = '';
      if (!set.has(user)) {
        if (!shift.eligibleStaff.includes(user)) {
          confirmMessage =  `Benutzer ${this.users[user]?.fullname || user} ist für die ausgewählte Schicht nicht berechtigt.`;

          if (!!shift.constraintViolations[user]?.length) {
            const reason = new TkdConstraintViolationPipe().transform(shift.constraintViolations[user])
            confirmMessage = `Benutzer ${this.users[user]?.fullname || user} ist aus folgenden Gründen für diese Schicht gesperrt:` + reason;
          }

        } else if (this.assigned[shift.shiftID]?.size >= shift.requiredStaffCount) {
          confirmMessage = `Es sind bereits genügend Mitarbeiter dieser Schicht zugewiesen.`
        }
      }

      if (!!confirmMessage) {
        this.nzModal.confirm({
          nzTitle: 'Bestätigung erforderlich',
          nzContent: confirmMessage + ' Möchtest du trotzdem fortfahren?',
          nzOkText: 'Zuweisen',
          nzOnOk: assign,
        })
      } else {
        assign()
      }

      return
    }

    trigger.elementRef.nativeElement.open = !trigger.elementRef.nativeElement.open;
  }

  onOverlayOutsideClick(event: MouseEvent, trigger: CdkOverlayOrigin) {
    let iter = event.target as HTMLElement;
    while (!!iter) {
      if (iter === trigger.elementRef.nativeElement) {
        return;
      }

      iter = iter.parentElement;
    }

    trigger.elementRef.nativeElement.open = false;
  }

  onContextMenu(event: Event, trigger: CdkOverlayOrigin) {
    // stop immediate propergation as onShiftClick() would close the
    // overlay immediately again.
    event.stopImmediatePropagation();
    event.preventDefault();

    trigger.elementRef.nativeElement.open = !trigger.elementRef.nativeElement.open;
    return false;
  }

  private publishRosterShift() {
    this.rosterShiftChange.next(
      Object.keys(this.assigned)
        .map(shiftID => {
          return {
            ...this.requiredShifts.find(s => s.shiftID === shiftID),
            staff: Array.from(this.assigned[shiftID].values())
          }
        })
    )
  }

  ngOnChanges(changes: SimpleChanges) {
    if ('rosterShifts' in changes || 'requiredShifts' in changes) {
      this.assigned = {};
      this.rosterShifts?.forEach(shift => {
        this.assigned[shift.shiftID] = new Set(shift.staff)
      })
    }
  }
}
