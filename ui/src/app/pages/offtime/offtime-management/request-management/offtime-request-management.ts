import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, OnDestroy, OnInit, Output, TrackByFunction } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { ProfileWithAvatar } from "@tkd/api";
import { NzMessageService } from "ng-zorro-antd/message";
import { NzModalService } from "ng-zorro-antd/modal";
import { BehaviorSubject, combineLatest, forkJoin, Subject, switchMap, take, takeUntil } from "rxjs";
import { UserService } from "src/app/api";
import { JSDuration, OffTime, Roster2Service } from "src/app/api/roster2";
import { extractErrorMessage } from "src/app/utils";
import { TkdApproveRejectOffTimeRequestComponent } from "../approve-reject-request";

interface LocalOffTimeRequest extends OffTime.Entry {
    profile?: ProfileWithAvatar
    creditsLeft: number;
}

@Component({
    selector: 'tkd-offtime-request-management',
    templateUrl: './offtime-request-management.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TkdOffTimeRequestManagementComponent implements OnInit, OnDestroy {
    private destroy = new Subject<void>();

    reload = new BehaviorSubject<void>(undefined)

    /** A list of all users */
    users: ProfileWithAvatar[] = [];

    /** A list of all off-time requests extended with the user profile */
    entries: LocalOffTimeRequest[] = [];

    /** A {@link TrackByFunction} for LocalOffTimeRequests */
    trackEntry: TrackByFunction<LocalOffTimeRequest> = (_, e) => e.id;

    /** Whether or not all or only new requests should be shown */
    showAll = false;

    /** A list of users to filter for */
    userFilter: string[] = [];

    @Output()
    onRequestDecision = new EventEmitter<void>();

    /** skipRouteChange is set to true when the next query-param update should be ignored */
    skipRouteChange = false;

    currentUserCredits: {
        [user: string]: JSDuration
    } = {};

    constructor(
        private rosterService: Roster2Service,
        private userService: UserService,
        private nzMessage: NzMessageService,
        private route: ActivatedRoute,
        private modal: NzModalService,
        private router: Router,
        private cdr: ChangeDetectorRef
    ) {}

    load() {
        combineLatest([
            this.userService.users
                .pipe(take(1)),
            this.reload.pipe(switchMap(() => forkJoin({
                entries: this.rosterService
                    .offTime
                    .findRequests(),
                credits: this.rosterService.offTime.credits(),
            }))),
        ])
            .pipe(takeUntil(this.destroy))
            .subscribe(([users, result]) => {
                this.users = users;

                const userSet = new Set(this.userFilter);
                this.currentUserCredits = result.credits;

                this.entries = (result.entries || [])
                    .map(e => {
                        return {
                            profile: this.userService.byName(e.staffID),
                            creditsLeft: (this.currentUserCredits[e.staffID] || 0) + e.costs.duration, // + because duration is negative
                            ...e,
                        }
                    })
                    .filter(entry => {
                        if (userSet.size > 0 && !userSet.has(entry.staffID)) {
                            return false;
                        }

                        if (!this.showAll && entry.approval !== null) {
                            return false;
                        }

                        return true;
                    })

                this.skipRouteChange = true;
                this.router.navigate(['.'], {
                    queryParams: {
                        user: this.userFilter || null,
                        all: this.showAll ? true : null,
                    },
                    queryParamsHandling: 'merge',
                    relativeTo: this.route,
                })

                this.cdr.markForCheck();
            })
    }
    
    deleteRequest(id: string) {
        this.modal.confirm({
            nzTitle: 'Antrag löschen?',
            nzContent: 'Soll dieser Antrag wirklich gelöscht werden?',
            nzOnOk: () => {
                this.rosterService.offTime.delete(id)
                    .subscribe({
                        next: () => this.load(),
                        error: err => this.nzMessage.error(extractErrorMessage(err, 'Antrag konnte nicht gelöscht werden'))
                    })
            }
        }, 'warning')
    }

    decide(id: string, decision: 'approve' | 'reject') {
        const ref = this.modal.create({
            nzContent: TkdApproveRejectOffTimeRequestComponent,
            nzComponentParams: {
                decision: decision,
                request: this.entries.find(e => e.id === id)!,
            }
        })

        ref.afterClose.subscribe(() => {
            this.reload.next()
            this.onRequestDecision.next()
        })
    }

    reject(id: string) {
        this.rosterService
            .offTime
            .reject(id)
            .subscribe({
                next: () => {
                    this.load()
                    this.onRequestDecision.next()
                },
                error: err => {
                    this.nzMessage.error(extractErrorMessage(err, 'Anfrage konnte nicht abgelehnt werden'))
                }
            })
    }

    approve(id: string, usedAsVacation?: boolean) {
        if (usedAsVacation === undefined) {
            usedAsVacation = this.entries.find(e => e.id === id).requestType === OffTime.RequestType.Vacation
        }

        this.rosterService
            .offTime
            .approve(id, usedAsVacation)
            .subscribe({
                next: () => {
                    this.load()
                    this.onRequestDecision.next()
                },
                error: err => {
                    this.nzMessage.error(extractErrorMessage(err, 'Anfrage konnte nicht genehmigt werden'))
                }
            })
    }

    ngOnInit(): void {
        this.route.queryParamMap
            .pipe(takeUntil(this.destroy))
            .subscribe((params) => {
                if (this.skipRouteChange) {
                    this.skipRouteChange = false
                    return
                }

                if (params.has('user')) {
                    this.userFilter = params.getAll('user')
                }

                if (params.has('all')) {
                    this.showAll = params.get('all') === 'true'
                }

                this.load()
            })
    }

    ngOnDestroy(): void {
        this.destroy.next();
        this.destroy.complete();
        this.reload.complete();
    }
}
