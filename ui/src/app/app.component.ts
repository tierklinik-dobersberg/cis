import { Component, isDevMode, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { of } from 'rxjs';
import { catchError, filter, map, mergeMap, share } from 'rxjs/operators';
import { IdentityAPI } from './api';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  isCollapsed = false;
  isDevMode = isDevMode();

  userAvatar: string = '';

  isLogin = this.router.events
    .pipe(
      filter(e => e instanceof NavigationEnd),
      map(() => {
        const isLogin = this.router.url.startsWith("/login")
        return isLogin;
      }),
      share()
    );

  constructor(private identity: IdentityAPI,
    private router: Router) { }

  logout() {
    this.identity.logout()
      .subscribe(() => this.router.navigate(['/', 'login']))
  }

  ngOnInit() {
    this.identity.profileChange
      .pipe(
        mergeMap(p => {
          if (!p) {
            return of('');
          }

          return this.identity.avatar(p.name)
        }),
        catchError(err => {
          return of('');
        })
      )
      .subscribe(
        icon => this.userAvatar = icon,
        err => console.error(err),
      )
  }
}
