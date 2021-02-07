import { Component, isDevMode, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, filter, map, mergeMap, share } from 'rxjs/operators';
import { ConfigAPI, IdentityAPI, Profile, UIConfig, VoiceMailAPI, VoiceMailRecording } from './api';
import { LayoutService } from './layout.service';

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
  profile: Profile | null = null;
  rootLinks: MenuEntry[] = []
  subMenus: SubMenu[] = [];
  menuMode: 'inline' | 'vertical' = 'inline';
  mailboxes: string[] = [];

  isLogin = this.router.events
    .pipe(
      filter(e => e instanceof NavigationEnd),
      map(() => {
        const isLogin = this.router.url.startsWith("/login")
        return isLogin;
      }),
      share()
    );

  constructor(
    private identity: IdentityAPI,
    private configapi: ConfigAPI,
    private router: Router,
    public layout: LayoutService,
    private voice: VoiceMailAPI,
  ) {
  }

  logout() {
    this.identity.logout()
      .subscribe(() => this.router.navigate(['/', 'login']))
  }

  toggleMenu() {
    this.isCollapsed = !this.isCollapsed;
  }

  ngOnInit() {
    this.configapi.change
      .subscribe(cfg => this.applyConfig(cfg));

    this.identity.profileChange
      .pipe(
        mergeMap(p => {
          if (p === null) {
            return of({
              profile: null,
              avatar: '',
            })
          }
          return forkJoin({
            profile: of(p),
            avatar: this.identity.avatar(p.name)
              .pipe(
                catchError(err => of('')),
              )
          })
        }),
      )
      .subscribe({
        next: result => {
          this.userAvatar = result.avatar;
          this.profile = result.profile;
        },
        error: console.error,
      });

    this.isCollapsed = this.layout.isPhone;
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
    this.voice.listMailboxes().subscribe(mailboxes => {
      console.log(mailboxes);
      this.mailboxes = mailboxes;
    })
  }
}
