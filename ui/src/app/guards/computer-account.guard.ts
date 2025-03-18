import { Injectable, computed, inject } from "@angular/core";
import { ActivatedRouteSnapshot, Router } from "@angular/router";
import { Observable, of } from "rxjs";
import { injectStoredConfig, injectStoredProfile } from "../utils/inject-helpers";

@Injectable({ providedIn: 'root' })
export class ComputerAccountGuard  {
    private readonly currentProfile = injectStoredProfile();
    private readonly config = injectStoredConfig();
    
    private readonly router = inject(Router);
    
    private readonly isComputerAccount = computed(() => {
      const profile = this.currentProfile();
      const cfg = this.config();

      if (cfg.UI?.ComputerAccountRole) {
        return profile.roles.some(r => r.id === cfg.UI.ComputerAccountRole) 
      }
      
      return false
    })

    canActivate(route: ActivatedRouteSnapshot): Observable<boolean> {
      if (this.isComputerAccount()) {
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

