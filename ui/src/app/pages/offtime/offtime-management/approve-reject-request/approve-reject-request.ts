import { ChangeDetectionStrategy, Component, OnInit } from "@angular/core";
import { ModalOptions, NzModalRef } from "ng-zorro-antd/modal";
import { OffTime, Roster2Service } from "src/app/api/roster2";

@Component({
    templateUrl: './approve-reject-request.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TkdApproveRejectOffTimeRequestComponent implements OnInit {
    /** The decision that should be stored */
    decision: 'approve' | 'reject' = 'reject'

    /** An additional comment */
    comment: string = '';

    /** The actual costs */
    actualCosts: string = '';

    /** The request that should be approved or rejected */
    request!: OffTime.Entry;

    constructor(
        private modalRef: NzModalRef,
        private rosterService: Roster2Service
    ) {
        const cfg = this.modalRef.getConfig();
        this.modalRef.updateConfig({
            ...cfg,
            nzFooter: null,
            nzWidth: 'fit-content',
        })
    }

    ngOnInit(): void {
        let title: string;
        if (this.decision === 'approve') {
            title = 'Anfrage genehmigen'
        } else {
            title = 'Anfrage ablehnen'
        }

        this.modalRef.updateConfig({
            ...this.modalRef.getConfig(),
            nzTitle: title,
        })
    }
}

