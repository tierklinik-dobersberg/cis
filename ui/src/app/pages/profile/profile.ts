import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { IdentityAPI, ProfileWithAvatar } from 'src/app/api';
import { HeaderTitleService } from 'src/app/shared/header-title';

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

  ngOnInit(): void {
    this.header.set('Mein Profil');

    this.subscriptions = new Subscription();

    const profileSub = this.identityapi.profileChange
      .subscribe(p => {
        this.profile = p;
      });

    this.subscriptions.add(profileSub);
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }
}
