import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, TrackByFunction } from "@angular/core";
import { NzMessageService } from "ng-zorro-antd/message";
import { NzModalService } from "ng-zorro-antd/modal";
import { OffTime, Roster2Service } from "src/app/api/roster2";
import { ProfileService } from "src/app/services/profile.service";
import { HeaderTitleService } from "src/app/shared/header-title";
import { extractErrorMessage } from "src/app/utils";
import { TkdCreateOfftimeRequestComponent } from "../create-offtime-request";

@Component({
    selector: 'tkd-my-offtime-requests',
    templateUrl: './my-offtime-requests.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TkdMyOffTimeRequestsComponent implements OnInit {
    constructor(
        private roster2: Roster2Service,
        private headerService: HeaderTitleService,
        private account: ProfileService,
        private nzModal: NzModalService,
        private nzMessage: NzMessageService,
        private cdr: ChangeDetectorRef,
    ) { }

    requests: OffTime.Entry[] = [];

    trackRequests: TrackByFunction<OffTime.Entry> = (_, req) => req.id!

    ngOnInit(): void {
        this.headerService.set(
            'Meine Urlaubs- und Abwesenheitsanträge',
            'Verwalte deine Urlaubsanträge und Abwesenheitszeiten'
        )

        this.loadRequests()
    }

    createNewRequest() {
        this.nzModal.create({
            nzContent: TkdCreateOfftimeRequestComponent,
            nzOnOk: () => {
                this.loadRequests();
            }
        })
    }

    deleteRequest(id: string) {
        this.nzModal.confirm({
            nzTitle: 'Antrag löschen',
            nzContent: 'Möchtest du den Antrag wirklich löschen?',
            nzOnOk: () => {
                this.roster2.offTime.delete(id)
                    .subscribe({
                        next: () => {
                            this.loadRequests()
                        },
                        error: err => {
                            this.nzMessage.error(
                                extractErrorMessage(err, 'Antrag konnte nicht gelöscht werden')
                            )
                        }
                    })
            }
        }, 'warning')
    }

    private loadRequests() {
        this.roster2.offTime.findRequests(this.account.snapshot.user.id)
            .subscribe({
                next: requests => {
                    this.requests = requests;
                    this.cdr.markForCheck()
                },
                error: err => {
                    this.nzMessage.error(
                        extractErrorMessage(err, 'Anträge konnten nicht geladen werden')
                    )
                }
            })
    }
}
