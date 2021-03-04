import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { ConfigAPI, IdentityAPI, ProfileWithAvatar, UserProperty, UserService } from 'src/app/api';
import { LayoutService } from 'src/app/services';
import { HeaderTitleService } from 'src/app/shared/header-title';

@Component({
  templateUrl: './users.html',
  styleUrls: ['./users.scss']
})
export class UserListComponent implements OnInit, OnDestroy {

  constructor(
    private header: HeaderTitleService,
    private userService: UserService,
    private configapi: ConfigAPI,
    public layout: LayoutService,
  ) { }
  private subscription = Subscription.EMPTY;

  expandSet = new Set<string>();
  userProps: UserProperty[] = [];

  profiles: ProfileWithAvatar[] = [];

  onExpandChange(id: string, checked: boolean): void {
    if (checked) {
      this.expandSet.add(id);
    } else {
      this.expandSet.delete(id);
    }
  }

  ngOnInit(): void {
    this.subscription = new Subscription();

    this.header.set('Benutzer / Mitarbeiter');

    this.subscription.add(
      this.configapi.change
        .pipe(filter(cfg => !!cfg))
        .subscribe(cfg => {
          this.userProps = (cfg.UserProperties || []).filter(prop => prop.visibility === 'public');
        })
    );

    this.subscription.add(
      this.userService.users
        .subscribe(profiles => this.profiles = profiles)
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }
}
