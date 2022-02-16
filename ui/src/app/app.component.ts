import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ApplicationRef, Component, HostListener, isDevMode, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { SwUpdate } from '@angular/service-worker';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';
import { BehaviorSubject, combineLatest, interval, of, Subject } from 'rxjs';
import { catchError, delay, filter, first, map, mergeMap, retryWhen, share, startWith, switchMap, take, takeUntil } from 'rxjs/operators';
import { LayoutService } from 'src/app/services';
import { ConfigAPI, IdentityAPI, Overwrite, Permissions, ProfileWithAvatar, RosterAPI, UIConfig, UserService, VoiceMailAPI } from './api';
import { InfoScreenAPI } from './api/infoscreen.api';
import { SuggestionCardComponent } from './pages/suggestions/suggestion-card';
import { SuggestionService } from './pages/suggestions/suggestion.service';
import { toggleRouteQueryParamFunc } from './utils';

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
export class AppComponent implements OnInit, OnDestroy {
  /** emits when the component is destroyed */
  private destory$ = new Subject();

  isCollapsed = false;
  isDevMode = isDevMode();

  profile: ProfileWithAvatar | null = null;
  rootLinks: MenuEntry[] = [];
  subMenus: SubMenu[] = [];
  menuMode: 'inline' | 'vertical' = 'inline';
  mailboxes: string[] = [];

  isReachable: boolean = true;
  checkRunning = false;

  /** The target of the current roster overwrite if any */
  overwriteTarget = '';

  /** Used to trigger a reload of the current overwrite target */
  private reloadOverwrite$ = new BehaviorSubject<void>(undefined);

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
    return this.identity.hasPermission(Permissions.RosterRead);
  }

  /** Returns true if the user can see voicemail records */
  get hasVoiceMail(): boolean {
    return this.identity.hasPermission(Permissions.VoicemailRead);
  }

  /** Returns true if the user can see calllogs */
  get hasCallLog(): boolean {
    return this.identity.hasPermission(Permissions.CalllogReadRecords);
  }

  /** Returns true if the user can see customer records */
  get hasCustomers(): boolean {
    return this.identity.hasPermission(Permissions.CustomerRead);
  }

  get hasInfoScreen(): boolean {
    return this.identity.hasPermission(Permissions.InfoScreenShowWrite)
      || this.identity.hasPermission(Permissions.InfoScreenShowsRead)
  }

  /**
   * Returns true if the user can create calendar events. For usability,
   * this also requires hasCustomer, hasCalllog and hasRoster
   */
  get canCreateEvent(): boolean {
    return this.identity.hasPermission(Permissions.CalendarWrite)
      && this.hasCallLog
      && this.hasCustomers
      && this.hasRoster;
  }

  infoScreenEnabled = false;

  constructor(
    private identity: IdentityAPI,
    private configapi: ConfigAPI,
    private router: Router,
    private activeRoute: ActivatedRoute,
    private nzMessage: NzMessageService,
    private modal: NzModalService,
    private appRef: ApplicationRef,
    private updates: SwUpdate,
    private roster: RosterAPI,
    public layout: LayoutService,
    private voice: VoiceMailAPI,
    private http: HttpClient,
    private userService: UserService,
    private showAPI: InfoScreenAPI,
    private suggestionService: SuggestionService,
  ) {
  }

  logout(): void {
    this.identity.logout()
      .subscribe(() => this.router.navigate(['/', 'login']));
  }

  readonly toggleMenu = toggleRouteQueryParamFunc(this.router, this.activeRoute, 'show-menu')

  openSuggestionDialog() {
    this.modal.create({
      nzContent: SuggestionCardComponent,
      nzWidth: '50vw',
      nzTitle: "Vorschläge",
      nzFooter: null,
    })
  }

  get suggestionCount() { return this.suggestionService.count$ }

  ngOnDestroy() {
    this.destory$.next();
    this.destory$.complete();
  }

  ngOnInit(): void {
    this.destory$ = new Subject();

    combineLatest([
      interval(15000),
      this.reloadOverwrite$
    ])
      .pipe(
        startWith(-1),
        takeUntil(this.destory$),
        switchMap(() => this.roster.getActiveOverwrite()
          .pipe(
            catchError(err => {
              if (!(err instanceof HttpErrorResponse) || err.status !== 404) {
                console.error(err);
              }
              return of(null as Overwrite);
            })
          ))
      )
      .subscribe(overwrite => {
        this.overwriteTarget = '';
        if (!!overwrite) {
          if (!!overwrite.username) {
            this.overwriteTarget = this.userService.byName(overwrite.username)?.fullname;
          } else {
            this.overwriteTarget = overwrite.displayName || overwrite.phoneNumber;
          }
        }
      })

    this.checkReachability();
    this.activeRoute.queryParamMap
      .pipe(takeUntil(this.destory$))
      .subscribe(params => {
        this.isCollapsed = !params.has('show-menu');
      })

    this.updates.available
      .pipe(take(1))
      .subscribe(event => {
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
      this.nzMessage.info('Gratuliere! Du verwendest nun die neuste Version von CIS');
    });

    if (!isDevMode()) {
      this.appRef.isStable.pipe(
        first(stable => !!stable),
        mergeMap(() => interval(10 * 60 * 1000).pipe(startWith(-1))),
      )
        .subscribe(() => {
          this.updates.checkForUpdate();
        });
    }

    this.layout.change
      .pipe(takeUntil(this.destory$))
      .subscribe(() => {
      this.isCollapsed = !this.layout.isTabletLandscapeUp;
    });

    this.configapi.change
      .pipe(takeUntil(this.destory$))
      .subscribe(cfg => this.applyConfig(cfg));

    this.identity.profileChange
      .pipe(takeUntil(this.destory$))
      .subscribe({
        next: result => {
          this.profile = result;
          if (this.profile?.needsPasswordChange) {
            this.layout.change.pipe(take(1))
              .subscribe(() => {
                if (!this.layout.isPhone) {
                  this.modal.info({
                    nzTitle: 'Ändere dein Passwort',
                    nzContent: 'Dein Passwort wurde noch nicht geändert. Aus Sicherheitsgründen solltest du dies unverzüglich nachholen.',
                    nzOkText: 'Passwort Ändern',
                    nzOnOk: async () => {
                      this.router.navigate(['/profile/change-password'])
                    },
                    nzCancelText: 'Jetzt nicht',
                    nzClosable: true,
                  });
                }
              })
          }

          this.showAPI.isEnabled()
            .subscribe(res => this.infoScreenEnabled = res);
        },
        error: console.error,
      });

    this.isCollapsed = this.layout.isPhone;
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
        this.modal.closeAll();
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

    (cfg?.ExternalLink || []).forEach(link => {
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
