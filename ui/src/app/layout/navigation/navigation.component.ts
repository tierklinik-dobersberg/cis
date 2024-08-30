import { NgClass } from '@angular/common';
import { booleanAttribute, ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, signal, untracked, ViewEncapsulation } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { lucideCalendar, lucideCircuitBoard, lucideCopyright, lucideFileAudio, lucideFilm, lucideHome, lucideLayers, lucidePhoneCall, lucidePlus, lucideTimer, lucideUserCircle } from '@ng-icons/lucide';
import { BrnMenuModule } from '@spartan-ng/ui-menu-brain';
import { BrnSheetComponent } from '@spartan-ng/ui-sheet-brain';
import { injectVoiceMailService } from '@tierklinik-dobersberg/angular/connect';
import { HlmIconModule, provideIcons } from '@tierklinik-dobersberg/angular/icon';
import { LayoutService } from '@tierklinik-dobersberg/angular/layout';
import { HlmMenuModule } from '@tierklinik-dobersberg/angular/menu';
import { Mailbox } from '@tierklinik-dobersberg/apis/pbx3cx/v1';
import { filter } from 'rxjs';
import { environment } from 'src/environments/environment';
import { injectCurrentConfig, UIConfig } from '../../api';
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
    NgClass,
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
      lucidePhoneCall
    })
  ]
})
export class AppNavigationComponent { 
  protected readonly layout = inject(LayoutService);
  protected readonly voiceService = injectVoiceMailService();
  protected readonly config = injectCurrentConfig()
  protected readonly destroyRef = inject(DestroyRef);
  protected readonly sheetRef = inject(BrnSheetComponent, {optional: true})
  protected readonly router = inject(Router);
  
  protected readonly rootLinks = signal<MenuEntry[]>([]);
  protected readonly subMenus = signal<SubMenu[]>([]);
  protected readonly mailboxes = signal<Mailbox[]>([]);

  public readonly sheet = input(false, { transform: booleanAttribute });

  protected changeProfile() {
    const redirectUrl = btoa(`${location.href}`);
    window.location.replace(`${environment.accountService}/login?force=true&redirect=${redirectUrl}`)
  }
  
  constructor() {
    effect(() => {
      const config = this.config();
      
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
