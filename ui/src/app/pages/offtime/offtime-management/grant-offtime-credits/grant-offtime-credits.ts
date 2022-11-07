import { ChangeDetectionStrategy, Component, OnInit } from "@angular/core";
import { NzMessageService } from "ng-zorro-antd/message";
import { NzModalRef } from "ng-zorro-antd/modal";
import { Roster2Service } from "src/app/api/roster2";
import { extractErrorMessage } from "src/app/utils";

@Component({
    templateUrl: './grant-offtime-credits.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TkdGrantOffTimeCredits implements OnInit {
    duration: number = 0;

    user: string = '';
    comment: string = '';

    constructor(
        private modalRef: NzModalRef,
        private nzMessage: NzMessageService,
        private rosterService: Roster2Service,
    ) {
        const cfg = this.modalRef.getConfig();
        this.modalRef.updateConfig({
            ...cfg,
            nzFooter: null,
            nzTitle: 'Urlaubstage Guthaben anpassen',
            nzWidth: 'fit-content'
        })
    }

    save() {
        this.rosterService.offTime.credit(this.user, this.duration, this.comment, new Date())
            .subscribe({
                next: () => {
                    this.modalRef.close();
                },
                error: err => {
                    this.nzMessage.error(extractErrorMessage(err, 'Urlaubstage konnten nicht geändert werden'))
                }
            })

    }

    abort() {
        this.modalRef.close();
    }

    ngOnInit(): void {

    }
}
