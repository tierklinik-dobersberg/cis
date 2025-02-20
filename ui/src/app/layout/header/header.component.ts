import { animate, style, transition, trigger } from '@angular/animations';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import {
  lucideCog,
  lucideLayers,
  lucidePlus,
  lucideUser
} from '@ng-icons/lucide';
import { BrnMenuModule } from '@spartan-ng/ui-menu-brain';
import { injectCurrentProfile } from '@tierklinik-dobersberg/angular/behaviors';
import {
  HlmIconModule,
  provideIcons,
} from '@tierklinik-dobersberg/angular/icon';
import { LayoutService } from '@tierklinik-dobersberg/angular/layout';
import { HlmMenuModule } from '@tierklinik-dobersberg/angular/menu';
import { AppMenuComponent } from 'src/app/components/app-menu';
import { AppAvatarComponent } from 'src/app/components/avatar';
import { openProfilePage } from 'src/app/services';
import { AppDoorStatusButtonComponent } from '../door-status-button';
import { HeaderTitleOutletComponent } from '../header-title';
import { AppSheetNavigationComponent } from '../navigation';
import { NavigationService } from '../navigation/navigation.service';
import { AppRedirectEmergencyButtonComponent } from '../redirect-emergency-button/redirect-emergency-button.component';

@Component({
  selector: 'app-header',
  standalone: true,
  templateUrl: './header.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    HlmMenuModule,
    BrnMenuModule,
    HlmIconModule,
    HeaderTitleOutletComponent,
    AppSheetNavigationComponent,
    AppRedirectEmergencyButtonComponent,
    AppDoorStatusButtonComponent,
    AppAvatarComponent,
    RouterModule,
    AppMenuComponent
  ],
  animations: [
    trigger('scaleInOut', [
      transition('void => *', [
        style({
          transform: 'scale(0%)',
          opacity: 0,
        }),
        animate('150ms ease-in-out', style({
          transform: 'scale(125%)',
          opacity: 1
        })),
        animate('150ms ease-in-out', style({
          transform: 'scale(100%)',
          opacity: 1
        }))
      ]),
      transition('* => void', [
        animate('150ms ease-in-out', style({
          transform: 'scale(125%)',
          opacity: 1
        })),
        animate('150ms ease-in-out', style({
          transform: 'scale(0%)',
          opacity: 0,
        }))
      ]),
    ])
  ],
  providers: [
    ...provideIcons({
      lucideUser,
      lucideLayers,
      lucideCog,
      lucidePlus,
    }),
  ],
})
export class AppHeaderComponent {
  protected readonly layout = inject(LayoutService);
  protected readonly profile = injectCurrentProfile();
  protected readonly showNav = inject(NavigationService).showNav;
  
  openProfilePage() {
    openProfilePage()
  }
}
