import { animate, style, transition, trigger } from '@angular/animations';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import {
  ApplicationRef,
  Component,
  HostListener,
  isDevMode,
  OnDestroy,
  OnInit
} from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { SwUpdate } from '@angular/service-worker';
import { Permissions, ProfileWithAvatar, TkdAccountService } from '@tkd/api';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';
import { BehaviorSubject, combineLatest, interval, of, Subject } from 'rxjs';
import {
  catchError,
  delay,
  filter,
  first,
  map,
  mergeMap,
  retryWhen,
  share,
  startWith,
  switchMap,
  take,
  takeUntil
} from 'rxjs/operators';
import { LayoutService } from 'src/app/services';
import {
  ConfigAPI, Overwrite,
  RosterAPI,
  UIConfig,
  UserService,
  VoiceMailAPI
} from './api';
import { InfoScreenAPI } from './api/infoscreen.api';
import { TkdCreateOfftimeRequestComponent } from './pages/offtime/create-offtime-request';
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
  styleUrls: ['./app.component.scss'],
  animations: [
    trigger('moveInOut', [
      transition('void => *', [
        style({
          transform: 'translateX(-100%)',
          opacity: 0,
          position: 'absolute',
        }),
        animate('150ms ease-in-out', style({
          transform: 'translateX(0%)',
          opacity: 1
        }))
      ]),
      transition('* => void', [
        animate('150ms ease-in-out', style({
          transform: 'translateX(-100%)',
          opacity: 0,
        }))
      ]),
    ])
  ]
})
export class AppComponent implements OnInit, OnDestroy {
  /** emits when the component is destroyed */
  private destroy$ = new Subject<void>();

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

  /** isLogin emits whether or not the login page is currently displayed */
  isLogin = this.router.events.pipe(
    filter((e) => e instanceof NavigationEnd),
    map(() =>  this.router.url.startsWith('/login')),
    share()
  );

  /** isWiki emits whether or not the user is currently inside the wiki module */
  isWiki = this.router.events.pipe(
    filter((e) => e instanceof NavigationEnd),
    map(() => this.router.url.startsWith('/wiki')),
    share()
  );

  isRoster2 = this.router.events.pipe(
    filter((e) => e instanceof NavigationEnd),
    map(() => this.router.url.startsWith('/roster/plan')),
    share()
  );

  /** Returns true if the user has (at least read-only) access to the roster */
  get hasRoster(): boolean {
    return this.account.hasPermission(Permissions.RosterRead);
  }

  /** Returns true if the user can see voicemail records */
  get hasVoiceMail(): boolean {
    return this.account.hasPermission(Permissions.VoicemailRead);
  }

  /** Returns true if the user can see calllogs */
  get hasCallLog(): boolean {
    return this.account.hasPermission(Permissions.CalllogReadRecords);
  }

  /** Returns true if the user can see customer records */
  get hasCustomers(): boolean {
    return this.account.hasPermission(Permissions.CustomerRead);
  }

  get hasInfoScreen(): boolean {
    return (
      this.account.hasPermission(Permissions.InfoScreenShowWrite) ||
      this.account.hasPermission(Permissions.InfoScreenShowsRead)
    );
  }

  /**
   * Returns true if the user can create calendar events. For usability,
   * this also requires hasCustomer, hasCalllog and hasRoster
   */
  get canCreateEvent(): boolean {
    return (
      this.account.hasPermission(Permissions.CalendarWrite) &&
      this.hasCallLog &&
      this.hasCustomers &&
      this.hasRoster
    );
  }

  infoScreenEnabled = false;

  constructor(
    private account: TkdAccountService,
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
    private suggestionService: SuggestionService
  ) {}

  logout(): void {
    this.account
      .logout()
      .subscribe(() => this.router.navigate(['/', 'login']));
  }

  readonly toggleMenu = toggleRouteQueryParamFunc(
    this.router,
    this.activeRoute,
    'show-menu'
  );

  openSuggestionDialog() {
    this.modal.create({
      nzContent: SuggestionCardComponent,
      nzWidth: '50vw',
      nzTitle: 'Vorschläge',
      nzFooter: null,
    });
  }

  get suggestionCount() {
    return this.suggestionService.count$;
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngOnInit(): void {
    this.destroy$ = new Subject();

    combineLatest([interval(15000), this.reloadOverwrite$])
      .pipe(
        startWith(-1),
        takeUntil(this.destroy$),
        switchMap(() =>
          this.roster.getActiveOverwrite().pipe(
            catchError((err) => {
              if (!(err instanceof HttpErrorResponse) || err.status !== 404) {
                console.error(err);
              }
              return of(null as Overwrite);
            })
          )
        )
      )
      .subscribe((overwrite) => {
        this.overwriteTarget = '';
        if (!!overwrite) {
          if (!!overwrite.username) {
            this.overwriteTarget = this.userService.byName(
              overwrite.username
            )?.fullname;
          } else {
            this.overwriteTarget =
              overwrite.displayName || overwrite.phoneNumber;
          }
        }
      });

    this.checkReachability();
    this.activeRoute.queryParamMap
      .pipe(takeUntil(this.destroy$))
      .subscribe((params) => {
        this.isCollapsed = !params.has('show-menu');
      });

    this.updates.versionUpdates.pipe(take(1)).subscribe((event) => {
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

    this.updates.activated.subscribe((event) => {
      this.nzMessage.info(
        'Gratuliere! Du verwendest nun die neuste Version von CIS'
      );
    });

    if (!isDevMode()) {
      this.appRef.isStable
        .pipe(
          first((stable) => !!stable),
          mergeMap(() => interval(10 * 60 * 1000).pipe(startWith(-1)))
        )
        .subscribe(() => {
          this.updates.checkForUpdate();
        });
    }

    this.layout.change.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.isCollapsed = !this.layout.isTabletLandscapeUp;
    });

    this.configapi.change
      .pipe(takeUntil(this.destroy$))
      .subscribe((cfg) => this.applyConfig(cfg));

    this.account.profileChange.pipe(takeUntil(this.destroy$)).subscribe({
      next: (result) => {
        this.profile = result;
        if (this.profile?.needsPasswordChange) {
          this.layout.change.pipe(take(1)).subscribe(() => {
            if (!this.layout.isPhone) {
              this.modal.info({
                nzTitle: 'Ändere dein Passwort',
                nzContent:
                  'Dein Passwort wurde noch nicht geändert. Aus Sicherheitsgründen solltest du dies unverzüglich nachholen.',
                nzOkText: 'Passwort Ändern',
                nzOnOk: async () => {
                  this.router.navigate(['/profile/change-password']);
                },
                nzCancelText: 'Jetzt nicht',
                nzClosable: true,
              });
            }
          });
        }

        this.showAPI
          .isEnabled()
          .subscribe((res) => (this.infoScreenEnabled = res));
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
    this.http
      .get('/api/')
      .pipe(
        retryWhen((d) => {
          this.isReachable = false;
          this.modal.closeAll();
          return d.pipe(delay(2000));
        })
      )
      .subscribe({
        next: () => {
          this.isReachable = true;
          this.checkRunning = false;
        },
        complete: () => {
          console.log('reachability check done');
        },
        error: (err) => console.error(err),
      });
  }

  createOffTimeRequest() {
    if (this.layout.isTabletPortraitUp) {
      this.modal.create({
        nzContent: TkdCreateOfftimeRequestComponent,
        nzFooter: null,
        nzWidth: 'fit-content',
      })
    } else {

    }
  }

  private applyConfig(cfg: UIConfig | null): void {
    const menus = new Map<string, SubMenu>();
    this.rootLinks = [];

    (cfg?.ExternalLink || []).forEach((link) => {
      if (!link.ParentMenu) {
        this.rootLinks.push(link);
        return;
      }

      let m = menus.get(link.ParentMenu);
      if (!m) {
        m = {
          Text: link.ParentMenu,
          Items: [],
        };
        menus.set(link.ParentMenu, m);
      }

      m.Items.push(link);
    });

    this.subMenus = Array.from(menus.values());
    this.voice.listMailboxes().subscribe((mailboxes) => {
      console.log(mailboxes);
      this.mailboxes = mailboxes;
    });
  }
}
