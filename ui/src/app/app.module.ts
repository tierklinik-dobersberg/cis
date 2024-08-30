import { LayoutModule } from '@angular/cdk/layout';
import { OverlayModule } from '@angular/cdk/overlay';
import { PlatformModule } from '@angular/cdk/platform';
import { registerLocaleData } from '@angular/common';
import { HTTP_INTERCEPTORS, HttpClientModule } from '@angular/common/http';
import de from '@angular/common/locales/de';
import { LOCALE_ID, NgModule, isDevMode } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { RouterModule } from '@angular/router';
import { ServiceWorkerModule } from '@angular/service-worker';
import { CKEditorModule } from '@ckeditor/ckeditor5-angular';
import { Code, ConnectError } from '@connectrpc/connect';
import {
  TkdConnectModule
} from '@tierklinik-dobersberg/angular/connect';
import { Breakpoints } from '@tierklinik-dobersberg/tailwind/breakpoints';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NZ_DATE_CONFIG, NZ_I18N, de_DE } from 'ng-zorro-antd/i18n';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzMessageModule } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { MarkdownModule } from 'ngx-markdown';
import { TimeagoModule } from 'ngx-timeago';
import { environment } from '../environments/environment';
import { AuthorizationInterceptor } from './api';
import { BaseURLInjector } from './api/base-url';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { IconsProviderModule } from './icons-provider.module';
import { NotAllowedComponent } from './pages/not-allowed';
import { SharedModule } from './shared/shared.module';

import { HlmButtonModule } from '@tierklinik-dobersberg/angular/button';
import { provideBreakpoints } from '@tierklinik-dobersberg/angular/layout';
import { HlmToasterModule } from '@tierklinik-dobersberg/angular/sonner';
import { AppHeaderComponent } from './layout';
import {
  AppNavigationComponent,
  AppSheetNavigationComponent,
} from './layout/navigation';

registerLocaleData(de);

@NgModule({
  declarations: [AppComponent, NotAllowedComponent],
  imports: [
    BrowserModule,
    AppRoutingModule,
    IconsProviderModule,
    OverlayModule,
    NzLayoutModule,
    NzMenuModule,
    NzAvatarModule,
    NzGridModule,
    NzDrawerModule,
    SharedModule,
    NzDropDownModule,
    FormsModule,
    HttpClientModule,
    NzMessageModule,
    NzBadgeModule,
    BrowserAnimationsModule,
    NzModalModule,
    MarkdownModule.forRoot(),
    RouterModule,
    LayoutModule,
    TimeagoModule.forRoot(),
    CKEditorModule,
    PlatformModule,
    HlmToasterModule,
    TkdConnectModule.forRoot(environment, [
      (err) => {
        if (ConnectError.from(err).code === Code.Unauthenticated) {
          const redirectTarget = btoa(`${location.href}`);
          window.location.replace(
            `${environment.accountService}/login?redirect=${redirectTarget}&force=true`,
          );
        }
      },
    ]),
    ServiceWorkerModule.register('ngsw-worker.js', {
      enabled: !isDevMode(),
      // Register the ServiceWorker as soon as the application is stable
      // or after 30 seconds (whichever comes first).
      registrationStrategy: 'registerWhenStable:30000',
    }),

    // FIXME: Migration
    HlmButtonModule,
    AppNavigationComponent,
    AppSheetNavigationComponent,
    AppHeaderComponent,
  ],
  providers: [
    { provide: NZ_I18N, useValue: de_DE },
    {
      provide: HTTP_INTERCEPTORS,
      useExisting: AuthorizationInterceptor,
      multi: true,
    },
    { provide: HTTP_INTERCEPTORS, useExisting: BaseURLInjector, multi: true },
    { provide: NZ_DATE_CONFIG, useValue: { firstDayOfWeek: 1 } },
    { provide: LOCALE_ID, useValue: 'de' },
    provideBreakpoints(Breakpoints),
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
