import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { Profile } from "@tkd/apis";
import { NzModalService } from "ng-zorro-antd/modal";
import { NzTabSetComponent } from "ng-zorro-antd/tabs";
import { Subject, combineLatest, take, takeUntil } from "rxjs";
import { UserService } from "src/app/api";
import { Roster2Service } from "src/app/api/roster2";
import { HeaderTitleService } from "src/app/shared/header-title";
import { TkdGrantOffTimeCredits } from "./grant-offtime-credits";

export interface ProfileWithCredits {
    profile: Profile,
    creditsLeft: number;
    daysLeft: number;
}

@Component({
    templateUrl: './offtime-management.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TkdOffTimeManagementComponent implements OnInit, OnDestroy, AfterViewInit {
    private destroy = new Subject<void>();

    @ViewChild(NzTabSetComponent)
    tabSet!: NzTabSetComponent;

    countNewRequests = 0;

    constructor(
        private rosterService: Roster2Service,
        private headerService: HeaderTitleService,
        private userService: UserService,
        private activeRoute: ActivatedRoute,
        private router: Router,
        private modal: NzModalService,
        private cdr: ChangeDetectorRef
    ) {}

    currentUserCredits: ProfileWithCredits[] = [];

    load() {
        this.rosterService.offTime
            .findRequests()
            .subscribe(results => {
                this.countNewRequests = results.reduce((count, req) => {
                    if (req.approval === null && req.costs.duration < 0) {
                        return count + 1;
                    }
                    return count
                }, 0)

                this.cdr.markForCheck()
            })

        combineLatest([
            this.userService.users,
            this.rosterService.offTime.credits()
        ])
            .subscribe(([profiles, result]) => {
                this.currentUserCredits = [];
                profiles.forEach(profile => {
                    this.currentUserCredits.push({
                        profile: profile,
                        creditsLeft: result[profile.user.id]?.credits ?? 0,
                        daysLeft: result[profile.user.id]?.days ?? 0,
                    })
                });
            });
    }

    updateRouterState(index: number) {
        let tabName = ''

        switch (index) {
            case 0:
                tabName = 'overview'
                break
            case 1:
                tabName = 'requests'
                break
        }

        this.router.navigate(['.'], {
            queryParams: {tab: tabName},
            queryParamsHandling: 'merge',
            relativeTo: this.activeRoute
        })
    }

    ngOnInit(): void {
        this.headerService.set(
            'Urlaubs- und Abwesenheitsanträge',
            'Verwalte Anträge auf Urlaub oder sonstige Abwesenheiten'
        )

        this.load();
    }

    grant(user: string) {
        const ref = this.modal.create({
            nzContent: TkdGrantOffTimeCredits,
            nzComponentParams: {
                user: user,
            }
        })

        ref.afterClose.pipe(take(1)).subscribe(() => this.load())
    }

    ngAfterViewInit(): void {
        this.activeRoute.queryParamMap
            .pipe(takeUntil(this.destroy))
            .subscribe(params => {
                if (params.has('tab')) {
                    let index = 0;
                    switch (params.get('tab')) {
                        case 'overview':
                            index = 0;
                            break;

                        case 'requests':
                            index = 1;
                            break
                    }

                    if (index !== this.tabSet.nzSelectedIndex) {
                        this.tabSet.setSelectedIndex(index)
                    }
                }

                this.cdr.markForCheck();
            });
    }

    ngOnDestroy(): void {
        this.destroy.next();
        this.destroy.complete();
    }
}
