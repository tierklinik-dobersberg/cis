import { Component, OnDestroy, OnInit } from "@angular/core";
import { forkJoin, of, Subscription } from "rxjs";
import { catchError, mergeMap } from "rxjs/operators";
import { IdentityAPI, Profile } from "src/app/api";

@Component({
    templateUrl: './profile.html',
    styleUrls: ['./profile.scss']
})
export class ProfileComponent implements OnInit, OnDestroy {
    userAvatar: string = '';

    profile: Profile | null = null;

    private subscriptions = Subscription.EMPTY;

    constructor(private identityapi: IdentityAPI) { }

    ngOnInit() {
        this.subscriptions = new Subscription();

        const profileSub = this.identityapi.profileChange
            .pipe(
                mergeMap(p => forkJoin({
                    profile: of(p),
                    avatar: !!p
                        ? this.identityapi.avatar(p.name)
                            .pipe(catchError(err => of(null)))
                        : of(null),
                }))
            )
            .subscribe(p => {
                this.profile = p.profile;
                this.userAvatar = p.avatar || '';
            });

        this.subscriptions.add(profileSub);
    }

    ngOnDestroy() {
        this.subscriptions.unsubscribe();
    }
}