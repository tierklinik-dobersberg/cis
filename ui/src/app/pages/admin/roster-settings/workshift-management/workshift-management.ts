import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, TrackByFunction } from "@angular/core";
import { NzMessageService } from "ng-zorro-antd/message";
import { NzModalService } from "ng-zorro-antd/modal";
import { take } from "rxjs/operators";
import { Roster2Service, Weekday, WorkShift } from "src/app/api/roster2";
import { extractErrorMessage } from "src/app/utils";
import { TkdWorkshiftDialogComponent } from "./workshift-dialog/workshift-dialog";

@Component({
    selector: 'tkd-workshift-management',
    templateUrl: './workshift-management.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TkdWorkshiftManagementComponent implements OnInit {
    workshifts: WorkShift[] = [];

    trackWorkShift: TrackByFunction<WorkShift> = (_: number, ws: WorkShift) => ws.id;

    readonly Weekdays = Weekday;

    constructor(
        private roster2: Roster2Service,
        private nzMessage: NzMessageService,
        private modal: NzModalService,
        private cdr: ChangeDetectorRef
    ) {}

    ngOnInit(): void {
        this.loadShifts();
    }

    private loadShifts() {
        this.roster2.workShifts
            .list()
            .subscribe({
                next: workshifts => {
                    this.workshifts = workshifts;
                    this.cdr.markForCheck();
                },
                error: err => {
                    this.nzMessage.error(extractErrorMessage(err, 'Arbeitsschichten konnten nicht geladen werden'))
                }
            })
    }

    createShift() {
        const ref = this.modal.create({
            nzContent: TkdWorkshiftDialogComponent,
        })

        ref.afterClose
            .pipe(take(1))
            .subscribe(result => {
                if (result === 'save') {
                    this.loadShifts();
                }
            })
    }
}