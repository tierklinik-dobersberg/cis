import { booleanAttribute, ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, signal, untracked, ViewEncapsulation } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { ConnectError } from '@connectrpc/connect';
import { lucideCalendar, lucideCircuitBoard, lucideCopyright, lucideFileAudio, lucideFilm, lucideHome, lucideLayers, lucidePhoneCall, lucidePhoneForwarded, lucidePlus, lucideTimer, lucideUserCircle } from '@ng-icons/lucide';
import { BrnMenuModule } from '@spartan-ng/ui-menu-brain';
import { BrnSheetComponent } from '@spartan-ng/ui-sheet-brain';
import { injectBoardService, injectVoiceMailService } from '@tierklinik-dobersberg/angular/connect';
import { HlmIconModule, provideIcons } from '@tierklinik-dobersberg/angular/icon';
import { LayoutService } from '@tierklinik-dobersberg/angular/layout';
import { HlmMenuModule } from '@tierklinik-dobersberg/angular/menu';
import { Mailbox } from '@tierklinik-dobersberg/apis/pbx3cx/v1';
import { Board, BoardEvent, ListBoardsResponse } from '@tierklinik-dobersberg/apis/tasks/v1';
import { toast } from 'ngx-sonner';
import { catchError, debounceTime, filter, finalize, from, interval, merge, of, retry, startWith, switchMap } from 'rxjs';
import { EventService } from 'src/app/services/event.service';
import { injectStoredConfig, injectStoredProfile } from 'src/app/utils/inject-helpers';
import { environment } from 'src/environments/environment';
import { UIConfig } from '../../api';
import { AppLogo } from './logo.component';
import { MenuFixDirective } from './menu-fix.directive';

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
  selector: 'app-navigation',
  standalone: true,
  templateUrl: './navigation.component.html',
  styleUrls: [
    './menu-style-overwrite.scss'
  ],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterModule,
    AppLogo,
    HlmIconModule,
    HlmMenuModule,
    BrnMenuModule,
    MenuFixDirective
  ],
  providers: [
    ...provideIcons({
      lucideHome,
      lucideCalendar,
      lucideTimer,
      lucideLayers,
      lucideUserCircle,
      lucideFilm,
      lucideFileAudio,
      lucideCopyright,
      lucidePlus,
      lucideCircuitBoard,
      lucidePhoneCall,
      lucidePhoneForwarded
    })
  ]
})
export class AppNavigationComponent { 
  protected readonly layout = inject(LayoutService);
  protected readonly voiceService = injectVoiceMailService();
  protected readonly config = injectStoredConfig()
  protected readonly destroyRef = inject(DestroyRef);
  protected readonly sheetRef = inject(BrnSheetComponent, {optional: true})
  protected readonly router = inject(Router);
  protected readonly boardService = injectBoardService();
  protected readonly profile = injectStoredProfile()
  protected readonly eventsService = inject(EventService);
  
  protected readonly rootLinks = signal<MenuEntry[]>([]);
  protected readonly subMenus = signal<SubMenu[]>([]);
  protected readonly mailboxes = signal<Mailbox[]>([]);
  protected readonly boards = signal<Board[]>([])

  public readonly sheet = input(false, { transform: booleanAttribute });


  protected changeProfile() {
    const redirectUrl = btoa(`${location.href}`);
    window.location.replace(`${environment.accountService}/login?force=true&redirect=${redirectUrl}`)
  }
  
  constructor() {
    merge(
      this.eventsService.subscribe(new BoardEvent),
      toObservable(this.profile),
      interval(60 * 1000 * 5).pipe(startWith(0)),
    )
    .pipe(
      filter((a) => {
        if (!this.profile()) {
          console.log("not loading boards, profile not ready")
          return false
        }

        return true
      }),
      retry({
        count: 4,
        delay: 1000,
      }),
      debounceTime(10),
      switchMap(() => {
        const ctrl = new AbortController();

        const loadBoards = this.boardService
          .listBoards({}, {signal: ctrl.signal});

        return from(loadBoards)
          .pipe(
            finalize(() => ctrl.abort()),
          )
      }),
      catchError(err => {
        toast.error('Task-Boards konnten nicht geladen werden', {
          description: ConnectError.from(err).message
        })

        return of(new ListBoardsResponse())
      })
    )
    .subscribe(res => {
      this.boards.set(res.boards || [])
    })

    effect(() => {
      const config = this.config();
      const profile = this.profile();

      if (!profile) {
        return
      }
      
      untracked(() => this.applyConfig(config))
    }, { allowSignalWrites: true })

    this.router.events
      .pipe(
        takeUntilDestroyed(),
        filter(event => event instanceof NavigationEnd && !!this.sheetRef)
      )
      .subscribe(() => {
        this.sheetRef.close(undefined, 100)
      })
  }

  private applyConfig(cfg: UIConfig | null): void {
    const menus = new Map<string, SubMenu>();
    const rootLinks = [];

    (cfg?.ExternalLink || []).forEach((link) => {
      if (!link.ParentMenu) {
        rootLinks.push(link);
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

    this.subMenus.set(Array.from(menus.values()));

    this.voiceService.listMailboxes({})
      .then(response => this.mailboxes.set(response.mailboxes))
  }
}
