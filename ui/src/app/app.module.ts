import { LayoutModule } from '@angular/cdk/layout';
import { registerLocaleData } from '@angular/common';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import de from '@angular/common/locales/de';
import { LOCALE_ID, NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { RouterModule } from '@angular/router';
import { ServiceWorkerModule, SwUpdate } from '@angular/service-worker';
import { FaIconLibrary, FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { far } from '@fortawesome/free-regular-svg-icons';
import { fas } from '@fortawesome/free-solid-svg-icons';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { de_DE, NZ_DATE_CONFIG, NZ_I18N } from 'ng-zorro-antd/i18n';
import { NzIconService } from 'ng-zorro-antd/icon';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzMessageServiceModule } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { MarkdownModule } from 'ngx-markdown';
import { environment } from '../environments/environment';
import { AuthorizationInterceptor } from './api';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { IconsProviderModule } from './icons-provider.module';
import { LoginModule } from './pages/login/login.module';
import { SuggestionModule } from './pages/suggestions/suggestion.module';
import { SharedModule } from './shared/shared.module';
import { NgChartsModule } from 'ng2-charts';
import { TimeagoModule } from 'ngx-timeago';
import { BaseURLInjector } from './api/base-url';
import { WikiModule } from './pages/wiki/wiki.module';
import * as iconExports from 'ng-heroicon';
import { HeroIconModule } from 'ng-heroicon';

registerLocaleData(de);

const icons: Record<string, {
        solid: string;
        outline: string;
    }> = {};

Object.keys(iconExports).forEach(key => {
  const value = iconExports[key];
  if (typeof value === 'object' && 'solid' in value && 'outline' in value) {
    icons[key] = value;
  }
})


@NgModule({
  declarations: [
    AppComponent,
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    IconsProviderModule,
    NzLayoutModule,
    NzMenuModule,
    NzAvatarModule,
    NzGridModule,
    NzDrawerModule,
    SharedModule,
    NzDropDownModule,
    FormsModule,
    HttpClientModule,
    NzMessageServiceModule,
    SuggestionModule,
    NzBadgeModule,
    BrowserAnimationsModule,
    NzModalModule,
    FontAwesomeModule,
    MarkdownModule.forRoot(),
    LoginModule,
    RouterModule,
    LayoutModule,
    TimeagoModule.forRoot(),
    ServiceWorkerModule.register('ngsw-worker.js', { enabled: environment.production }),
    NgChartsModule,
    WikiModule, // TODO(ppacher): make this lazy loaded in the future. We need it here for the
                // navigation component right now ...
    HeroIconModule.forRoot(
      icons,
      {
        defaultHostDisplay: 'inlineBlock',
        attachDefaultDimensionsIfNoneFound: true,
      }
    ),
  ],
  providers: [
    { provide: NZ_I18N, useValue: de_DE },
    { provide: HTTP_INTERCEPTORS, useExisting: AuthorizationInterceptor, multi: true },
    { provide: HTTP_INTERCEPTORS, useExisting: BaseURLInjector, multi: true },
    { provide: NZ_DATE_CONFIG, useValue: { firstDayOfWeek: 1 } },
    { provide: LOCALE_ID, useValue: 'de'}
  ],
  bootstrap: [AppComponent]
})
export class AppModule {
  constructor(library: FaIconLibrary, iconService: NzIconService) {
    library.addIconPacks(fas, far);
  }
}
