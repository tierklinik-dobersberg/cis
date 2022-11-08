import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, TrackByFunction } from "@angular/core";
import { NzMessageService } from "ng-zorro-antd/message";
import { NzModalService } from "ng-zorro-antd/modal";
import { filter, take } from "rxjs/operators";
import { Constraint, Roster2Service } from "src/app/api/roster2";
import { extractErrorMessage } from "src/app/utils";
import { TkdConstraintDialogComponent } from "./constraint-dialog/constraint-dialog";

@Component({
    selector: 'tkd-constraint-management',
    templateUrl: './constraint-management.html',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class TkdConstraintManagementComponent implements OnInit {
    constraints: Constraint[] = [];

    trackConstraint: TrackByFunction<Constraint> = (_, c) => c.id;

    constructor(
        private roster2: Roster2Service,
        private nzModal: NzModalService,
        private nzMessage: NzMessageService,
        private cdr: ChangeDetectorRef
    ) {}

    ngOnInit(): void {
       this.loadConstraints(); 
    }

    createConstraint() {
        this.nzModal.create({
            nzContent: TkdConstraintDialogComponent,
        })
        .afterClose
        .pipe(
            take(1),
            filter(action => action !== 'abort')
        )
        .subscribe(() => this.loadConstraints());
    }

    editConstraint(constraint: Constraint) {
        this.nzModal.create({
            nzContent: TkdConstraintDialogComponent,
            nzComponentParams: {
                constraint: constraint,
            }
        })
        .afterClose
        .pipe(
            take(1),
            filter(action => action !== 'abort')
        )
        .subscribe(() => this.loadConstraints());
    }

    private loadConstraints() {
        this.roster2
            .constraints
            .find()
            .subscribe({
                next: result => {
                    this.constraints = result;
                    this.cdr.markForCheck();
                },
                error: err => {
                    this.nzMessage.error(extractErrorMessage(err, 'Regeln konnten nicht geladen werden'))
                }
            })
    }
}