import { Injectable } from "@angular/core";
import { ActivatedRouteSnapshot, CanActivate, Router } from "@angular/router";
import { Observable, of } from "rxjs";
import { catchError, map, timeout } from "rxjs/operators";
import { UserService } from "../api";

@Injectable({ providedIn: 'root' })
export class UsersReadyGuard implements CanActivate {
    constructor(
      private users: UserService,
      private router: Router,
    ) { }

    canActivate(route: ActivatedRouteSnapshot): Observable<boolean> {
      return this.users.updated
        .pipe(
          timeout(4000),
          map(() => true),
          catchError(() => {
            console.error(`timed out navigating to ${route.toString()}`, route)
            this.router.navigate(['/login']);

            return of(false);
          })
        )
    }
}
