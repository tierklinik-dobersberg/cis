import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnInit, Optional, inject } from "@angular/core";
import { Role } from "@tkd/apis";
import { NzMessageService } from "ng-zorro-antd/message";
import { NzModalRef } from "ng-zorro-antd/modal";
import { ROLE_SERVICE } from "src/app/api/connect_clients";
import { Roster2Service, Weekday, WorkShift } from "src/app/api/roster2";
import { extractErrorMessage } from "src/app/utils";
import { Duration } from "src/utils/duration";

@Component({
    selector: 'tkd-workshift-dialog',
    templateUrl: './workshift-dialog.html',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class TkdWorkshiftDialogComponent implements OnInit {
    @Input()
    workshift?: WorkShift;

    roleService = inject(ROLE_SERVICE);

    isEdit = false;
    isColorSelectorOpen = false;

    showMinutesWorth = false;

    roles: Role[] = [];

    onCall: boolean = false;

    readonly Weekdays = Weekday;

    get duration() {
        if (!this.workshift.duration) {
            return null;
        }

        return Duration.milliseconds(this.workshift!.duration).format('default-hours')
    }

    setDuration(value: string) {
        this.workshift!.duration = Duration.parseString(value).milliseconds
    }

    get minutesWorth() {
        if (!this.workshift.minutesWorth) {
            return null;
        }
        return Duration.minutes(this.workshift!.minutesWorth || 0).format('default-hours')
    }

    setMinutesWorth(value: string) {
        this.workshift!.minutesWorth = Duration.parseString(value).minutes
    }

    constructor(
        private roster2: Roster2Service,
        private cdr: ChangeDetectorRef,
        private nzMessage: NzMessageService,
        @Optional() private nzModalRef?: NzModalRef,
    ) {
        nzModalRef?.updateConfig({
            ...nzModalRef?.getConfig(),
            nzFooter: null,
        })
    }

    changeOnCall(onCall: boolean) {
      this.workshift.tags = this.workshift.tags.filter(tag => tag !== 'OnCall')
      if (onCall) {
        this.workshift.tags = [
          'OnCall',
          ...this.workshift.tags,
        ]
      }
    }

    ngOnInit(): void {
        if (this.workshift) {
          if (this.workshift.id) {
            this.isEdit = true;
            if (this.workshift.minutesWorth === undefined) {
                this.workshift.minutesWorth = 0;
            }
            this.onCall = this.workshift?.tags.includes('OnCall')
          }
        } else {
            this.workshift = {
                days: [],
                duration: 0,
                eligibleRoles: [],
                from: '',
                id: '',
                name: '',
                shortName: '',
                onHoliday: false,
                requiredStaffCount: 0,
                minutesWorth: 0,
                color: '',
                order: 0,
                description: '',
                tags: [],
            }
        }

        this.showMinutesWorth = this.workshift.minutesWorth > 0;

        this.roleService.listRoles({})
            .then(response => {
                    this.roles = response.roles;
                    this.cdr.markForCheck();
                })
            .catch(err => {
                    this.nzMessage.error(extractErrorMessage(err, 'Benutzer-Rollen konnten nicht geladen werden'))
            })
    }

    save() {
        const result = {
            ...this.workshift
        }

        if (result.minutesWorth === 0) {
            delete(result.minutesWorth)
        }

        this.roster2.workShifts
            .create(this.workshift)
            .subscribe({
                next: () => {
                    this.nzModalRef?.close('save');
                },
                error: err => {
                    this.nzMessage.error(extractErrorMessage(err, 'Schicht konnte nicht erstellt werden'))
                }
            })
    }

    abort() {
        this.nzModalRef?.close('abort');
    }

    deleteShift() {
        this.roster2.workShifts
            .delete(this.workshift.id)
            .subscribe({
                next: () => {
                    this.nzModalRef?.close('delete');
                },
                error: err => {
                    this.nzMessage.error(extractErrorMessage(err, 'Schicht konnte nicht gelöscht werden'))
                }
            })
    }
}
