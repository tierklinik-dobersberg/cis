import { ChangeDetectorRef, Component, Optional } from "@angular/core";
import { TkdAccountService } from "@tkd/api";
import { NzMessageService } from "ng-zorro-antd/message";
import { NzModalRef } from "ng-zorro-antd/modal";
import { DayKinds, OffTime, Roster2Service } from "src/app/api/roster2";
import { extractErrorMessage } from "src/app/utils";

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
        private account: TkdAccountService,
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

    /** An optional description for the off-time request */
    description: string = '';

    /** Whether or not this is a vacation request or not */
    isVacationRequest: boolean | null = null;

    /** The number of working days (except holiday and weekends)  */
    dayKinds: DayKinds | null = null;

    /** The date-range for the off-time request */
    rangeDate = (() => {
        const now = new Date();
        return [
            new Date(now.getFullYear(), now.getMonth() + 1, 1),
            new Date(now.getFullYear(), now.getMonth() + 1, 2)
        ]
    })()

    onRangeChange(value: [Date, Date]) {
        this.rosterService.roster.dayKinds(value[0], value[1])
            .subscribe(kinds => {
                this.dayKinds = kinds;
                this.cdr.markForCheck();
            })
    }

    updateVacationRequest() {
        if (this.isVacationRequest === null) {
            this.isVacationRequest = true;

            return
        }

        if (this.isVacationRequest === true) {
            this.isVacationRequest = false;
            
            return
        }

        this.isVacationRequest = null;
    }

    create() {
        let requestType: OffTime.RequestType;

        switch (this.isVacationRequest) {
            case null:
                requestType = OffTime.RequestType.Auto
                break;
            case true:
                requestType = OffTime.RequestType.Vacation
                break;
            case false:
                requestType = OffTime.RequestType.TimeOff
                break;
        }

        this.rosterService.offTime.create({
            from: this.rangeDate[0].toISOString(),
            to: this.rangeDate[1].toISOString(),
            description: this.description,
            requestType: requestType,
            staff: this.account.currentProfile.name,
        })
            .subscribe({
                next: () => {
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

