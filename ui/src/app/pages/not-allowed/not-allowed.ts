import { ChangeDetectionStrategy, Component, OnInit, inject } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { HlmButtonDirective } from "@tierklinik-dobersberg/angular/button";
import { DisplayNamePipe } from "@tierklinik-dobersberg/angular/pipes";
import { HeaderTitleService } from "src/app/layout/header-title";
import { injectStoredProfile } from "src/app/utils/inject-helpers";
import { environment } from "src/environments/environment";

@Component({
  standalone: true,
  templateUrl: './not-allowed.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DisplayNamePipe,
    HlmButtonDirective
  ]
})
export class NotAllowedComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly titleService = inject(HeaderTitleService);
  private readonly accountService = environment.accountService;

  protected readonly currentUser = injectStoredProfile();

  reason: string = '';
  deniedRoute: string = '';
  redirectUrl: string = '';

  ngOnInit(): void {
    this.route
      .queryParamMap
      .subscribe(map => {
        this.reason = map.get("reason");

        if (!this.reason) {
          this.router.navigate(['/'])
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
