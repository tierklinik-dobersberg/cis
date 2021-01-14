import { Component, isDevMode, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, filter, map, mergeMap, share } from 'rxjs/operators';
import { ConfigAPI, IdentityAPI, UIConfig } from './api';

interface MenuEntry {
  Icon: string;
  Link: string;
  Text: string;
  BlankTarget: boolean;
}

interface SubMenu {
  Text: string;
  Items: MenuEntry[];
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  isCollapsed = false;
  isDevMode = isDevMode();

  userAvatar: string = '';

  rootLinks: MenuEntry[] = []
  subMenus: SubMenu[] = [];

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
    private configapi: ConfigAPI,
    private router: Router) { }

  logout() {
    this.identity.logout()
      .subscribe(() => this.router.navigate(['/', 'login']))
  }

  ngOnInit() {
    this.configapi.change
      .subscribe(cfg => this.applyConfig(cfg));

    this.identity.profileChange
      .pipe(
        mergeMap(p => {
          return this.identity.avatar(p.name)
        }),
        catchError(err => of('')),
      )
      .subscribe({
        next: icon => {
          this.userAvatar = icon;
        },
        error: console.error,
      });
  }

  private applyConfig(cfg: UIConfig | null) {
    let menus = new Map<string, SubMenu>();
    this.rootLinks = [];

    (cfg?.ExternalLinks || []).forEach(link => {
      if (!link.ParentMenu) {
        this.rootLinks.push(link)
        return
      }

      let m = menus.get(link.ParentMenu);
      if (!m) {
        m = {
          Text: link.ParentMenu,
          Items: []
        }
        menus.set(link.ParentMenu, m)
      }

      m.Items.push(link)
    })

    this.subMenus = Array.from(menus.values());
  }
}
