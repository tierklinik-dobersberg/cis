import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, Optional, inject } from "@angular/core";
import { Profile, Role } from "@tkd/apis";
import { NzMessageService } from "ng-zorro-antd/message";
import { NzModalRef } from "ng-zorro-antd/modal";
import { Observable } from "rxjs";
import { UserService } from "src/app/api";
import { ROLE_SERVICE } from "src/app/api/connect_clients";
import { Constraint, Roster2Service } from "src/app/api/roster2";
import { extractErrorMessage } from "src/app/utils";

@Component({
    selector: 'tkd-constraint-dialog',
    templateUrl: './constraint-dialog.html',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class TkdConstraintDialogComponent implements OnInit {
    isEdit = false;

    constraint!: Constraint;

    profiles: Profile[] = [];
    roles: Role[] = []

    roleSerivce = inject(ROLE_SERVICE);

    constructor(
        private roster2: Roster2Service,
        private cdr: ChangeDetectorRef,
        private nzMessage: NzMessageService,
        private usersService: UserService,
        @Optional() private nzModalRef?: NzModalRef,
    ) {
        nzModalRef?.updateConfig({
            ...nzModalRef?.getConfig(),
            nzFooter: null,
        })
    }

    ngOnInit(): void {
        if (!!this.constraint) {
            this.isEdit = true;
        } else {
            this.constraint = {
                appliesToRole: [],
                appliesToUser: [],
                deny: false,
                expression: '',
                hard: false,
                penalty: 0,
                rosterOnly: false,
                description: '',
            }
        }

        this.roleSerivce.listRoles({})
            // FIXME(unsub)
            .then(response => {
                this.roles = response.roles;
                this.cdr.markForCheck();
            })

        this.usersService.users
            // FIXME(unsub)
            .subscribe(users => {
                this.profiles = users;
                this.cdr.markForCheck();
            })
    }

    abort() {
        this.nzModalRef?.close('abort');
    }

    save() {
        let sub: Observable<void>;

        if (this.isEdit) {
            sub = this.roster2.constraints
                .update(this.constraint);
        } else {
            sub = this.roster2.constraints
                .create(this.constraint)
        }

        sub.subscribe({
            next: () => {
                this.nzModalRef?.close('save')
            },
            error: err => {
                this.nzMessage.error(extractErrorMessage(err, 'Regel konnte nicht gespeichert werden'))
            }
        })
    }

    deleteConstraint() {
        this.roster2.constraints.delete(this.constraint.id)
            .subscribe({
                next: () => {
                    this.nzModalRef?.close('delete')
                },
                error: err => {
                    this.nzMessage.error(extractErrorMessage(err, 'Regel konnte nicht gelöscht werden'))
                }
            })
    }
}
