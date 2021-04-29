import { HttpClient } from '@angular/common/http';
import { ApplicationRef, Component, HostListener, isDevMode, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { SwUpdate } from '@angular/service-worker';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';
import { interval, of } from 'rxjs';
import { catchError, delay, filter, first, map, mergeMap, retryWhen, share, startWith, take, takeUntil, tap } from 'rxjs/operators';
import { LayoutService } from 'src/app/services';
import { ConfigAPI, IdentityAPI, Permission, ProfileWithAvatar, UIConfig, VoiceMailAPI } from './api';

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

  profile: ProfileWithAvatar | null = null;
  rootLinks: MenuEntry[] = [];
  subMenus: SubMenu[] = [];
  menuMode: 'inline' | 'vertical' = 'inline';
  mailboxes: string[] = [];

  isReachable: boolean = true;
  checkRunning = false;

  isLogin = this.router.events
    .pipe(
      filter(e => e instanceof NavigationEnd),
      map(() => {
        const isLogin = this.router.url.startsWith('/login');
        return isLogin;
      }),
      share()
    );

  /** Returns true if the user has (at least read-only) access to the roster */
  get hasRoster(): boolean {
    return this.identity.hasPermission(Permission.RosterRead);
  }

  /** Returns true if the user can see voicemail records */
  get hasVoiceMail(): boolean {
    return this.identity.hasPermission(Permission.VoicemailRead);
  }

  /** Returns true if the user can see calllogs */
  get hasCallLog(): boolean {
    return this.identity.hasPermission(Permission.CalllogReadRecords);
  }

  /** Returns true if the user can see customer records */
  get hasCustomers(): boolean {
    return this.identity.hasPermission(Permission.CustomerRead);
  }

  /**
   * Returns true if the user can create calendar events. For usability,
   * this also requires hasCustomer, hasCalllog and hasRoster
   */
  get canCreateEvent(): boolean {
    return this.identity.hasPermission(Permission.CalendarWrite)
      && this.hasCallLog
      && this.hasCustomers
      && this.hasRoster;
  }

  constructor(
    private identity: IdentityAPI,
    private configapi: ConfigAPI,
    private router: Router,
    private nzMessage: NzMessageService,
    private modal: NzModalService,
    private appRef: ApplicationRef,
    private updates: SwUpdate,
    public layout: LayoutService,
    private voice: VoiceMailAPI,
    private http: HttpClient,
  ) {
  }

  logout(): void {
    this.identity.logout()
      .subscribe(() => this.router.navigate(['/', 'login']));
  }

  toggleMenu(): void {
    this.isCollapsed = !this.isCollapsed;
  }

  ngOnInit(): void {
    this.checkReachability();

    this.updates.available.subscribe(event => {
      this.modal.info({
        nzTitle: 'Neue Version verfügbar',
        nzContent: 'Einen neue Version von CIS ist verfügbar!',
        nzOkText: 'Update',
        nzOnOk: async () => {
          await this.updates.activateUpdate();
          document.location.reload();
        },
        nzClosable: false,
      });
    });

    this.updates.activated.subscribe(event => {
      this.nzMessage.info('Gratuliere! Du verwendest nun Version ' + event.current + ' von CIS');
    });

    this.appRef.isStable.pipe(first(stable => !!stable))
      .subscribe(() => this.updates.checkForUpdate());

    this.layout.change.subscribe(() => {
      this.isCollapsed = !this.layout.isTabletLandscapeUp;
    });

    this.configapi.change
      .subscribe(cfg => this.applyConfig(cfg));

    this.identity.profileChange
      .subscribe({
        next: result => {
          this.profile = result;
        },
        error: console.error,
      });

    this.isCollapsed = this.layout.isPhone;

    this.router.events
      .subscribe(event => {
        if (event instanceof NavigationEnd && this.layout.isPhone) {
          this.isCollapsed = true;
        }
      });
  }

  @HostListener('window:focus')
  checkReachability() {
    if (this.checkRunning) {
      return;
    }
    this.checkRunning = true;
    this.http.get('/api/')
      .pipe(retryWhen(d => {
        this.isReachable = false;
        return d.pipe(delay(2000));
      }))
      .subscribe({
        next: () => {
          this.isReachable = true;
          this.checkRunning = false;
        },
        complete: () => {
          console.log("reachability check done")
        },
        error: err => console.error(err)
      })
  }

  private applyConfig(cfg: UIConfig | null): void {
    const menus = new Map<string, SubMenu>();
    this.rootLinks = [];

    (cfg?.ExternalLinks || []).forEach(link => {
      if (!link.ParentMenu) {
        this.rootLinks.push(link);
        return;
      }

      let m = menus.get(link.ParentMenu);
      if (!m) {
        m = {
          Text: link.ParentMenu,
          Items: []
        };
        menus.set(link.ParentMenu, m);
      }

      m.Items.push(link);
    });

    this.subMenus = Array.from(menus.values());
    this.voice.listMailboxes().subscribe(mailboxes => {
      console.log(mailboxes);
      this.mailboxes = mailboxes;
    });
  }
}
