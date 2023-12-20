import { firstValueFrom, of } from 'rxjs';
import { animate, style, transition, trigger } from '@angular/animations';
import { HttpClient } from '@angular/common/http';
import {
  ApplicationRef,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  inject,
  isDevMode
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { SwPush, SwUpdate } from '@angular/service-worker';
import { Code, ConnectError } from '@connectrpc/connect';
import { Duration, Timestamp } from '@bufbuild/protobuf';
import { Profile } from '@tierklinik-dobersberg/apis';
import { GetOverwriteResponse } from '@tierklinik-dobersberg/apis/gen/es/tkd/pbx3cx/v1/calllog_pb';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';
import { BehaviorSubject, combineLatest, concat, interval } from 'rxjs';
import { Platform } from '@angular/cdk/platform';
import {
  delay,
  distinctUntilChanged,
  filter,
  first,
  mergeMap,
  repeat,
  retry,
  skipWhile,
  startWith,
  switchMap,
  take,
  tap
} from 'rxjs/operators';
import { LayoutService } from 'src/app/services';
import {
  ConfigAPI,
  UIConfig,
  UserService,
  VoiceMailAPI
} from './api';
import { CALL_SERVICE, NOTIFY_SERIVCE, TkdConnectModule } from './api/connect_clients';
import { ProfileService } from './services/profile.service';
import { toggleRouteQueryParamFunc } from './utils';
import { environment } from 'src/environments/environment';
import { platformBrowser } from '@angular/platform-browser';

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
export class AppComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly profileService = inject(ProfileService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly callService = inject(CALL_SERVICE);
  private readonly notifyService = inject(NOTIFY_SERIVCE);
  private readonly swPush = inject(SwPush);
  private readonly platform = inject(Platform);

  /** Whether or not the menu is collapsed */
  isCollapsed = false;

  isDevMode = isDevMode();

  /** The current user profile */
  profile?: Profile;


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

  constructor(
    private configapi: ConfigAPI,
    private router: Router,
    private activeRoute: ActivatedRoute,
    private nzMessage: NzMessageService,
    private modal: NzModalService,
    private appRef: ApplicationRef,
    private updates: SwUpdate,
    public layout: LayoutService,
    private voice: VoiceMailAPI,
    private http: HttpClient,
    private userService: UserService,
  ) {}

  readonly toggleMenu = toggleRouteQueryParamFunc(
    this.router,
    this.activeRoute,
    'show-menu'
  );

  openProfilePage() {
    this.profileService.openProfilePage();
  }

  changeProfile() {
    const redirectUrl = btoa(`${location.href}`);

    window.location.replace(`${environment.accountService}/login?force=true&redirect=${redirectUrl}`)
  }

  setupWebPush() {
    this.notifyService
      .getVAPIDPublicKey({})
      .then(res => {
        return res.key
      })
      .then(key => {
        return this.swPush.requestSubscription({
          serverPublicKey: key,
        })
      })
      .catch(err => {
        console.error(err);
      });
  }

  private updateWebPushSubscription() {
    // make sure we update our web-push subscription
    if (this.swPush.isEnabled) {

      this.profileService
        .profile$
        .pipe(
          filter(profile => !!profile),
          take(1),
          switchMap(() => {
            return this.swPush.subscription
          }),
          distinctUntilChanged((prev, curr) => prev?.endpoint === curr?.endpoint)
        )
          .subscribe({
            next: sub => {
            if (sub === null) {
              try {
                if (localStorage.getItem("cis:asked_for_webpush")) {
                  return;
                }
                localStorage.setItem("cis:asked_for_webpush", "true")
              } catch(err) {
                console.error(err)

                // Do not ask if there was an error
                return
              }

              this.modal
                .confirm({
                  nzTitle: 'Benachrichtigungen aktivieren',
                  nzContent: 'CIS kann Benachrichtigungen an dein Gerät senden um dich über Änderungen am Dienstplan oder Urlaubsanträge zu informieren. Möchtest du diese Benachrichtigungen aktivieren?',
                  nzOkText: 'Aktivieren',
                  nzCancelText: 'Nein danke',
                  nzOnOk: () => {
                    this.setupWebPush();
                  }
                })
            } else {
              this.notifyService.addWebPushSubscription({
                subscription: {
                  endpoint: sub!.endpoint,
                  keys: {
                    p256dh: btoa(String.fromCharCode(...new Uint8Array(sub!.getKey("p256dh")!))),
                    auth: btoa(String.fromCharCode(...new Uint8Array(sub!.getKey("auth")!))),
                  }
                },
              })
            }
          },
          complete: () => {
            debugger;
          }
        })
    }

  }

  ngOnInit(): void {
    if (this.updates.isEnabled) {
      // version updates
      this.updates.versionUpdates.subscribe(evt => {
        switch (evt.type) {
          case 'VERSION_READY':
            this.modal
              .confirm({
                nzTitle: 'Neue Version verfügbar',
                nzContent: 'Eine neue Version von CIS wurde installiert. Bitte lade die Applikation neu um auf die neue Version zu wechseln',
                nzOkText: 'Jetzt verwenden',
                nzOnOk: () => {
                  window.location.reload();
                },
                nzCancelText: 'Später'
              })

            break;

          case 'VERSION_INSTALLATION_FAILED':
            this.nzMessage.error(`Failed to install app version '${evt.version.hash}': ${evt.error}`);
            break;
        }
      });

      // Allow the app to stabilize first, before starting
      // polling for updates with `interval()`.
      const appIsStable$ = this.appRef.isStable.pipe(first(isStable => isStable === true));
      const everySixHours$ = interval( 60 * 60 * 1000)
        .pipe(startWith(-1));

      const everyHourOnceAppIsStable$ = concat(appIsStable$, everySixHours$);

      everyHourOnceAppIsStable$.subscribe(async () => {
        try {
          const updateFound = await this.updates.checkForUpdate();
          console.log(updateFound ? 'A new version is available.' : 'Already on the latest version.');
        } catch (err) {
          console.error('Failed to check for updates:', err);
        }
      });

      this.updates.unrecoverable.subscribe(event => {
        this.nzMessage.error(
          'An error occurred that we cannot recover from:' +
          event.reason +
          ' Please reload the page.'
        );
      });
    }

    this.updateWebPushSubscription();

    // watch the user profile.
    this.profileService
      .profile$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(profile => {
        this.profile = profile;

        this.cdr.markForCheck();
      });

    this.reloadOverwrite$
      .pipe(
        repeat({delay: 20000}),
        takeUntilDestroyed(this.destroyRef),
        switchMap(() =>
          this.callService.getOverwrite({
            selector: {
              case: 'activeAt',
              value: Timestamp.fromDate(new Date()),
            }
          }).catch(err => {
              const cerr = ConnectError.from(err);
              if (cerr.code !== Code.NotFound) {
                console.log(cerr)
              }

              return new GetOverwriteResponse()
            })
          )
        )
      .subscribe((overwrite) => {
        this.overwriteTarget = '';
        if (!overwrite.overwrites?.length) {
          return;
        }

        const first = overwrite.overwrites[0];

        switch (first.target.case) {
          case 'custom':
            this.overwriteTarget =
              first.target.value.displayName || first.target.value.transferTarget;
            break
          case 'userId':
            this.overwriteTarget = this.userService.byId(
              first.target.value,
            )?.user.username

            break;
        }
      });

    this.checkReachability();

    this.activeRoute.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        this.isCollapsed = !params.has('show-menu');
      });

    this.configapi.change
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((cfg) => this.applyConfig(cfg));
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
        tap({
          error: err => {
            this.isReachable = false;
            this.modal.closeAll();

            if (ConnectError.from(err).code === Code.Unauthenticated) {
              const redirectTarget = btoa(`${location.href}`);
              window.location.replace(`${environment.accountService}/login?redirect=${redirectTarget}&force=true`);
            }
          }
        }),
        retry({delay: 2000})
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
      this.mailboxes = mailboxes;

      this.cdr.markForCheck();
    });
  }
}
