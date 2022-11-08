import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnInit, Optional } from "@angular/core";
import { NzMessageService } from "ng-zorro-antd/message";
import { NzModalRef } from "ng-zorro-antd/modal";
import { IdentityAPI, Role } from "src/app/api";
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

    isEdit = false;
    isColorSelectorOpen = false;

    showMinutesWorth = false;

    roles: Role[] = [];

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
        private identityAPI: IdentityAPI,
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

    ngOnInit(): void {
        if (this.workshift) {
            this.isEdit = true;
            if (this.workshift.minutesWorth === undefined) {
                this.workshift.minutesWorth = 0;
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
            }
        }

        this.showMinutesWorth = this.workshift.minutesWorth > 0;

        this.identityAPI.getRoles()
            .subscribe({
                next: roles => {
                    this.roles = roles;
                    this.cdr.markForCheck();
                },
                error: err => {
                    this.nzMessage.error(extractErrorMessage(err, 'Benutzer-Rollen konnten nicht geladen werden'))
                }
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
