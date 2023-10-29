import { Injectable } from "@angular/core";
import { ActivatedRouteSnapshot } from "@angular/router";
import { Observable, of } from "rxjs";
import { catchError, map, timeout } from "rxjs/operators";
import { UserService } from "../api";

@Injectable({ providedIn: 'root' })
export class UsersReadyGuard  {
    constructor(
      private users: UserService,
    ) { }

    canActivate(route: ActivatedRouteSnapshot): Observable<boolean> {
      return this.users.updated
        .pipe(
          timeout(4000),
          map(() => true),
          catchError(() => {
            return of(false);
          })
        )
    }
}
