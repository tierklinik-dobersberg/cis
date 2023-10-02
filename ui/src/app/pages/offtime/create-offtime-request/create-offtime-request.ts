import { ChangeDetectorRef, Component, Optional } from "@angular/core";
import { NzMessageService } from "ng-zorro-antd/message";
import { NzModalRef } from "ng-zorro-antd/modal";
import { DayKinds, OffTime, Roster2Service } from "src/app/api/roster2";
import { ProfileService } from "src/app/services/profile.service";
import { UserNamePipe } from "src/app/shared/pipes";
import { extractErrorMessage } from "src/app/utils";
import { UserService } from './../../../api/user.service';

@Component({
  selector: 'tkd-create-offtime-request',
  templateUrl: 'create-offtime-request.html',
  styles: [
    `
        :host {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
        }
        `
  ]
})
export class TkdCreateOfftimeRequestComponent {
  constructor(
    private rosterService: Roster2Service,
    private nzMessage: NzMessageService,
    private cdr: ChangeDetectorRef,
    private account: ProfileService,
    public users: UserService,
    @Optional() public modalRef?: NzModalRef,
  ) {
    if (!!this.modalRef) {
      const cfg = this.modalRef.getConfig()
      cfg.nzTitle = 'Neuer Abwesenheitsantrag'
      cfg.nzWidth = 'fit-content'
      cfg.nzFooter = null

      this.modalRef.updateConfig(cfg)
    }
  }

  readonly requestTypes = OffTime.RequestType;

  /** Whether or not the administrator is creating the request. */
  isAdmin: boolean = false;

  /** Holds the name of the user this request is for. This requires isAdmin == true */
  staffId: string = '';

  /** An optional description for the off-time request */
  description: string = '';

  /** The number of working days (except holiday and weekends)  */
  dayKinds: DayKinds | null = null;

  /** Whether or not a single day or a date range is expected */
  createRange = false;

  get singleDate() {
    if (!this.rangeDate) {
      return null;
    }
    return this.rangeDate[0];
  }

  requestType: OffTime.RequestType = OffTime.RequestType.Auto;

  /** The date-range for the off-time request */
  rangeDate: [Date, Date] | null = null;

  onRangeChange(value: [Date, Date]) {
    if (value[0].getTime() > value[1].getTime()) {
      const oldTo = value[1];
      value[1] = value[0]
      value[0] = oldTo

      this.rangeDate = [...value];
    }

    this.rosterService.roster.dayKinds(value[0], value[1])
      .subscribe(kinds => {
        this.dayKinds = kinds;
        this.cdr.markForCheck();
      })
  }

  create() {
    this.rosterService.offTime.create({
      from: this.rangeDate[0].toISOString(),
      to: this.rangeDate[1].toISOString(),
      description: this.description,
      requestType: this.requestType,
      staff: this.isAdmin ? this.staffId : this.account.snapshot.user.id
    })
      .subscribe({
        next: (entry) => {
          if (this.isAdmin) {
            // let's approve this one also since it was created by the administrator
            let costs: number | undefined;
            if (this.requestType === OffTime.RequestType.TimeOff) {
              costs = 0
            }

            this.rosterService
              .offTime
              .approve(entry.id, costs, "Antrag erstellt von " + UserNamePipe.transform(this.account.snapshot))
              .subscribe(() => {
                this.nzMessage.success('Antrag automatisch genehmigt');
              })
          }

          this.modalRef?.triggerOk()
          this.nzMessage.success('Antrag erfolgreich erstellt');
        },
        error: err => {
          this.nzMessage.error(
            extractErrorMessage(err, 'Antrag konnte nicht erstellt werden')
          )
        }
      })
  }
}

