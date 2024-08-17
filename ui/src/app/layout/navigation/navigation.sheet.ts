import { ChangeDetectionStrategy, Component } from '@angular/core';
import { lucideMenu } from '@ng-icons/lucide';
import { BrnSheetModule } from '@spartan-ng/ui-sheet-brain';
import { HlmButtonDirective } from '@tierklinik-dobersberg/angular/button';
import {
  HlmIconModule,
  provideIcons,
} from '@tierklinik-dobersberg/angular/icon';
import { HlmSheetModule } from '@tierklinik-dobersberg/angular/sheet';
import { AppLogo } from './logo.component';
import { AppNavigationComponent } from './navigation.component';

@Component({
  selector: 'app-navigation-sheet',
  standalone: true,
  // eslint-disable-next-line prettier/prettier
  template:`
    <hlm-sheet side="left">
      <button hlmBtn variant="ghost" size="icon" brnSheetTrigger>
        <hlm-icon name="lucideMenu" />
      </button>

      <hlm-sheet-content *brnSheetContent="let ctx" class="w-96 p-0 flex flex-col">
        <hlm-sheet-header>
          <app-logo class="ml-1 h-14 px-4 py-4" />
        </hlm-sheet-header>
        <app-navigation class="flex-grow" sheet="true" />
      </hlm-sheet-content>
    </hlm-sheet>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    HlmSheetModule,
    BrnSheetModule,
    AppNavigationComponent,
    HlmButtonDirective,
    HlmIconModule,
    AppLogo,
  ],
  providers: [...provideIcons({ lucideMenu })],
})
export class AppSheetNavigationComponent {}
