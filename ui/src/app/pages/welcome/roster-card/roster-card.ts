import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { BehaviorSubject, combineLatest, interval, of, Subject, Subscriber, Subscription } from 'rxjs';
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
        let triggerReload = new BehaviorSubject<void>(undefined);

        this.subscriptions = new Subscription();

        let userSubscription = this.identityapi.listUsers()
            .pipe(retryWhen(err => err.pipe(delay(5000))))
            .subscribe(users => {
                users.forEach(user => {
                    this.users.set(user.name, user);
                    triggerReload.next();
                });
            })
        this.subscriptions.add(userSubscription);

        let rosterSubscription = combineLatest([
            interval(10000),
            triggerReload,
        ])
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