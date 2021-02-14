import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { interval, of, Subscriber, Subscription } from 'rxjs';
import { catchError, delay, map, mergeMap, retryWhen, startWith } from 'rxjs/operators';
import { Day, IdentityAPI, ProfileWithAvatar, Roster, RosterAPI } from 'src/app/api';

@Component({
    selector: 'app-roster-card',
    templateUrl: './roster-card.html',
    styleUrls: ['./roster-card.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RosterCardComponent implements OnInit, OnDestroy {
    private subscriptions = Subscription.EMPTY;
    users = new Map<string, ProfileWithAvatar>();
    today: Day | null = null;

    constructor(
        private rosterapi: RosterAPI,
        private identityapi: IdentityAPI,
        private changeDetector: ChangeDetectorRef,
    ) { }

    ngOnInit() {
        this.subscriptions = new Subscription();

        let userSubscription = this.identityapi.listUsers({ includeAvatars: true })
            .pipe(retryWhen(err => err.pipe(delay(5000))))
            .subscribe(users => {
                users.forEach(user => {
                    this.users.set(user.name, user);
                });
                this.changeDetector.markForCheck();
            })
        this.subscriptions.add(userSubscription);

        let rosterSubscription = interval(10000)
            .pipe(
                startWith(-1),
                mergeMap(() => {
                    const now = new Date();
                    return this.rosterapi.forMonth(now.getFullYear(), now.getMonth() + 1);
                }),
                catchError(err => {
                    return of(null);
                }),
                map((roster: Roster | null) => {
                    if (!roster) {
                        return null;
                    }

                    console.log(roster.days);
                    console.log(new Date().getDate());
                    return roster!.days[new Date().getDate()] || null;
                })
            )
            .subscribe((day: Day | null) => {
                this.today = day;
                this.changeDetector.markForCheck();
            })
        this.subscriptions.add(rosterSubscription);
    }

    ngOnDestroy() {
        this.subscriptions.unsubscribe();
    }
}