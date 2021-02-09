import { HttpErrorResponse } from "@angular/common/http";
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, TrackByFunction } from "@angular/core";
import { NzMessageService } from "ng-zorro-antd/message";
import { BehaviorSubject, combineLatest, interval, of, Subscription, throwError } from "rxjs";
import { catchError, delay, map, mergeMap, retryWhen, startWith } from "rxjs/operators";
import { DoctorOnDuty, ExternalAPI, IdentityAPI, ProfileWithAvatar, RosterAPI } from "src/app/api";
import { LayoutService } from "src/app/layout.service";
import { extractErrorMessage } from "src/app/utils";

@Component({
    selector: 'app-emergency-card',
    templateUrl: './emergency-card.html',
    styleUrls: ['./emergency-card.scss'],
    //changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmergencyCardComponent implements OnInit, OnDestroy {
    private subscriptions = Subscription.EMPTY;
    private reload = new BehaviorSubject<void>(undefined);

    onDuty: DoctorOnDuty[] = [];
    onDutyUntil: Date | null = null;
    firstLoad = true;
    userAvatar: string = '';
    primaryOnDuty: string = '';
    overwritePhone: string = '';
    drawerVisible = false;

    allUsers: ProfileWithAvatar[] = [];

    trackBy: TrackByFunction<DoctorOnDuty> = (_: number, item: DoctorOnDuty) => item.username;

    constructor(
        private externalapi: ExternalAPI,
        private identityapi: IdentityAPI,
        private rosterapi: RosterAPI,
        private nzMessageService: NzMessageService,
        private changeDetector: ChangeDetectorRef,
        public layout: LayoutService,
    ) { }

    toggleDrawer() {
        this.drawerVisible = !this.drawerVisible;
        this.overwritePhone = '';
    }

    configureOverwrite(user?: string) {
        this.rosterapi.setOverwrite({
            username: user || '',
            phoneNumber: this.overwritePhone,
        }).subscribe(
            () => {
                this.nzMessageService.success("Dienstplan überschrieben.")
                this.drawerVisible = false;
                this.reload.next();
            },
            err => {
                this.nzMessageService.error(extractErrorMessage(err, 'Dienstplan konnte nicht überschrieben werden'))
            }
        )
    }

    ngOnInit() {
        this.subscriptions = new Subscription();

        const allUsersSub = this.identityapi.listUsers({ includeAvatars: true })
            .subscribe(users => this.allUsers = users);
        this.subscriptions.add(allUsersSub);

        const sub = combineLatest([
            interval(20000).pipe(startWith(0)),
            this.reload
        ])
            .pipe(
                mergeMap(() => this.externalapi.getDoctorsOnDuty()),
                catchError(err => {
                    // we might get a 404 if there's no roster defined for today.
                    if (err instanceof HttpErrorResponse && err.status === 404) {
                        return of({
                            doctors: [],
                            until: null,
                        });
                    }

                    return throwError(err);
                }),
                retryWhen(errors => errors.pipe(delay(5000))),
            )
            .subscribe({
                next: result => {
                    this.firstLoad = false;
                    this.onDuty = result.doctors || [];
                    this.onDutyUntil = result.until;

                    if (this.onDuty.length === 0) {
                        this.primaryOnDuty = '',
                            this.userAvatar = '';
                    } else if (this.onDuty[0].username !== this.primaryOnDuty) {
                        this.primaryOnDuty = this.onDuty[0].username;
                        this.identityapi.avatar(this.primaryOnDuty)
                            .subscribe(
                                avatar => {
                                    this.userAvatar = avatar;
                                    this.changeDetector.detectChanges();
                                },
                                err => {
                                    console.error(err);
                                    this.userAvatar = '';
                                    this.changeDetector.detectChanges();
                                }
                            )
                    }
                    this.changeDetector.markForCheck();
                },
            });

        this.subscriptions.add(sub);
    }

    ngOnDestroy() {
        this.subscriptions.unsubscribe();
    }
}

