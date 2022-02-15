import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, TrackByFunction } from "@angular/core";
import { NzMessageService } from "ng-zorro-antd/message";
import { IdentityAPI, Role } from "src/app/api";
import { HeaderTitleService } from "src/app/shared/header-title";
import { extractErrorMessage } from "src/app/utils";

@Component({
  templateUrl: './role-list.html',
  styleUrls: ['./role-list.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RoleListComponent implements OnInit {
  roles: Role[] = [];

  trackRole: TrackByFunction<Role> = (_: number, role: Role) => role.name;

  constructor(
    private identityapi: IdentityAPI,
    private nzMessageService: NzMessageService,
    private headerTitleService: HeaderTitleService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.headerTitleService.set(
      "Benutzer Rollen",
      "Verwalte Berechtigungen mittels Benutzer Rollen.",
      null,
      [{name: 'Administration', route: '/admin/'}]
    )
    this.identityapi.getRoles()
      .subscribe({
        next: roles => {
          this.roles = roles;
          this.cdr.markForCheck();
        },
        error: err => this.nzMessageService.error(extractErrorMessage(err, 'Benutzerrollen konnten nicht geladen werden'))
      })
  }
}
