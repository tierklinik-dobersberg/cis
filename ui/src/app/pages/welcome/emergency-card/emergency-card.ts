import { HttpErrorResponse } from "@angular/common/http";
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, TrackByFunction } from "@angular/core";
import { NzMessageService } from "ng-zorro-antd/message";
import { BehaviorSubject, combineLatest, interval, of, Subscription, throwError } from "rxjs";
import { catchError, delay, map, mergeMap, retryWhen, startWith } from "rxjs/operators";
import { DoctorOnDuty, ExternalAPI, IdentityAPI, ProfileWithAvatar, RosterAPI } from "src/app/api";
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
    dropDownVisible: boolean = false;

    allUsers: ProfileWithAvatar[] = [];

    trackBy: TrackByFunction<DoctorOnDuty> = (_: number, item: DoctorOnDuty) => item.username;

    constructor(
        private externalapi: ExternalAPI,
        private identityapi: IdentityAPI,
        private rosterapi: RosterAPI,
        private nzMessageService: NzMessageService,
        private changeDetector: ChangeDetectorRef) { }


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
                    this.changeDetector.markForCheck();

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
                },
            });

        this.subscriptions.add(sub);
    }

    changeOnDuty(user: ProfileWithAvatar) {
        this.dropDownVisible = false;

        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        const day = now.getDate();

        this.rosterapi.forMonth(year, month)
            .pipe(
                map(roster => {
                    const rosterDay = roster.days[day] || { afternoon: [], forenoon: [], emergency: [] };
                    rosterDay.emergency.splice(0, 1, user.name);
                    rosterDay.emergency = [
                        user.name,
                        ...rosterDay.emergency.slice(1).filter(u => u !== user.name),
                    ]
                    roster.days[day] = rosterDay;
                    return roster;
                }),
                mergeMap(roster => this.rosterapi.create(roster))
            )
            .subscribe(
                () => {
                    this.nzMessageService.success("Dienstplan erfolgreich geändert");
                    this.reload.next();
                },
                err => {
                    this.nzMessageService.error(extractErrorMessage(err, 'Dienstplan konnte nicht geändet werden'))
                }
            )
    }

    ngOnDestroy() {
        this.subscriptions.unsubscribe();
    }
}

