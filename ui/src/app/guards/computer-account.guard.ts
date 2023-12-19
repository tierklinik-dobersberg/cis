import { Injectable, inject } from "@angular/core";
import { ActivatedRouteSnapshot, Router } from "@angular/router";
import { Observable, of } from "rxjs";
import { ProfileService } from "../services/profile.service";

@Injectable({ providedIn: 'root' })
export class ComputerAccountGuard  {
    private readonly profileService = inject(ProfileService);
    private readonly router = inject(Router);

    canActivate(route: ActivatedRouteSnapshot): Observable<boolean> {
      if (this.profileService.isComputerAccount) {
        this.router.navigate(['/not-allowed'], {
          queryParams: {
            reason: 'computer-account',
            route: route.url.toString(),
          }
        })
        return of(false);
      }

      return of(true);
    }
}

