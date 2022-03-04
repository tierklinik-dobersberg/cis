import { Injectable } from "@angular/core";
import { CanActivate } from "@angular/router";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import { UserService } from "../api";

@Injectable({ providedIn: 'root' })
export class UsersReadyGuard implements CanActivate {
    constructor(private users: UserService) { }

    canActivate(): Observable<boolean> {
      const timeout = setTimeout(() => {
        debugger;
      }, 5000)
      return this.users.updated
            .pipe(map(() => {
              clearTimeout(timeout)
              return true;
            }))
    }
}
