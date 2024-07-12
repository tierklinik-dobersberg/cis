import { CdkMenu } from '@angular/cdk/menu';
import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, ViewChild, ViewEncapsulation, booleanAttribute, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterModule } from '@angular/router';
import { lucideCalendar, lucideCircuitBoard, lucideCopyright, lucideFileAudio, lucideFilm, lucideHome, lucideLayers, lucidePlus, lucideTimer, lucideUserCircle } from '@ng-icons/lucide';
import { BrnMenuModule } from '@spartan-ng/ui-menu-brain';
import { HlmIconModule, provideIcons } from '@tierklinik-dobersberg/angular/icon';
import { LayoutService } from '@tierklinik-dobersberg/angular/layout';
import { HlmMenuModule } from '@tierklinik-dobersberg/angular/menu';
import { HlmSheetHeaderComponent } from '@tierklinik-dobersberg/angular/sheet';
import { environment } from 'src/environments/environment';
import { ConfigAPI, UIConfig, VoiceMailAPI } from '../../api';
import { ProfileService } from '../../services';
import { AppLogo } from './logo.component';

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
    HlmSheetHeaderComponent,
    AppLogo,
    NgClass,
    HlmIconModule,
    HlmMenuModule,
    BrnMenuModule
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
      lucideCircuitBoard
    })
  ]
})
export class AppNavigationComponent implements OnInit {
  protected readonly layout = inject(LayoutService);
  protected readonly voiceService = inject(VoiceMailAPI);
  protected readonly profileService = inject(ProfileService);
  protected readonly config = inject(ConfigAPI);
  protected readonly destroyRef = inject(DestroyRef);
  
  protected readonly rootLinks = signal<MenuEntry[]>([]);
  protected readonly subMenus = signal<SubMenu[]>([]);
  protected readonly mailboxes = signal<string[]>([]);

  public readonly sheet = input(false, { transform: booleanAttribute });

  protected changeProfile() {
    const redirectUrl = btoa(`${location.href}`);
    window.location.replace(`${environment.accountService}/login?force=true&redirect=${redirectUrl}`)
  }
  
  @ViewChild(CdkMenu, {static: true})
  protected readonly menu: CdkMenu;

  ngOnInit(): void {
    // Fix for hlm-menu not expected to be rendered inline.
    (this.menu as any)._parentTrigger = {
      _spartanLastPosition: {
        originX: "start"
      }
    }

    this.config
      .change
      .pipe(
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(cfg => {
        this.applyConfig(cfg);
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

    this.voiceService.listMailboxes()
      .subscribe((mailboxes) => {
        this.mailboxes.set(mailboxes);
      });
  }
}
