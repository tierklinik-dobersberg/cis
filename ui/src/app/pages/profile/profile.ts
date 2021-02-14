import { Component, OnDestroy, OnInit } from "@angular/core";
import { forkJoin, of, Subscription } from "rxjs";
import { catchError, mergeMap } from "rxjs/operators";
import { IdentityAPI, Profile, ProfileWithAvatar } from "src/app/api";
import { HeaderTitleService } from "src/app/shared/header-title";

@Component({
    templateUrl: './profile.html',
    styleUrls: ['./profile.scss']
})
export class ProfileComponent implements OnInit, OnDestroy {
    profile: ProfileWithAvatar | null = null;

    private subscriptions = Subscription.EMPTY;

    constructor(
        private header: HeaderTitleService,
        private identityapi: IdentityAPI
    ) { }

    ngOnInit() {
        this.header.set('Mein Profil')

        this.subscriptions = new Subscription();

        const profileSub = this.identityapi.profileChange
            .subscribe(p => {
                this.profile = p;
            });

        this.subscriptions.add(profileSub);
    }

    ngOnDestroy() {
        this.subscriptions.unsubscribe();
    }
}