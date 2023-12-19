import { ChangeDetectionStrategy, Component, OnInit, inject } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { ProfileService } from "src/app/services/profile.service";
import { HeaderTitleService } from "src/app/shared/header-title";
import { environment } from "src/environments/environment";

@Component({
  templateUrl: './not-allowed.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotAllowedComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly titleService = inject(HeaderTitleService);
  private readonly profileService = inject(ProfileService);
  private readonly accountService = environment.accountService;

  get profile() {
    return this.profileService.profile$;
  }

  reason: string = '';
  deniedRoute: string = '';
  redirectUrl: string = '';

  ngOnInit(): void {
    this.route
      .queryParamMap
      .subscribe(map => {
        this.reason = map.get("reason") || '';

        if (!this.reason) {
          this.router.navigate(['/welcome'])
          return;
        }

        this.deniedRoute = map.get("route") || '';
        this.redirectUrl = '';

        if (!!this.deniedRoute) {
          const redirectTarget = btoa(`${location.origin}/${this.deniedRoute}`);

          this.redirectUrl = `${this.accountService}/login?redirect=${redirectTarget}&force=true`
        }

        this.titleService.set(
          'Zugriff verweigert',
          'Der Zugriff auf die geforderte Seite wurde verweigert'
        );
      })
  }
}
