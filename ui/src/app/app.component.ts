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
import { SwUpdate } from '@angular/service-worker';
import { Code, ConnectError } from '@connectrpc/connect';
import { Timestamp } from '@bufbuild/protobuf';
import { Profile } from '@tierklinik-dobersberg/apis';
import { GetOverwriteResponse } from '@tierklinik-dobersberg/apis/gen/es/tkd/pbx3cx/v1/calllog_pb';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';
import { BehaviorSubject, combineLatest, concat, interval } from 'rxjs';
import {
  delay,
  first,
  mergeMap,
  repeat,
  retry,
  startWith,
  switchMap
} from 'rxjs/operators';
import { LayoutService } from 'src/app/services';
import {
  ConfigAPI,
  UIConfig,
  UserService,
  VoiceMailAPI
} from './api';
import { CALL_SERVICE } from './api/connect_clients';
import { ProfileService } from './services/profile.service';
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
export class AppComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly profileService = inject(ProfileService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly callService = inject(CALL_SERVICE);


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

  ngOnInit(): void {

    this.updates.versionUpdates.subscribe(evt => {
      switch (evt.type) {
        case 'VERSION_DETECTED':
          this.nzMessage.info(`Downloading new app version: ${evt.version.hash}`);
          break;
        case 'VERSION_READY':
          this.nzMessage.info(`New app version ready for use: ${evt.latestVersion.hash}. Please reload the page`);
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
        retry({
          delay: (d) => {
            this.isReachable = false;
            this.modal.closeAll();
            return d.pipe(delay(2000));
          }
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
