import { LayoutModule } from '@angular/cdk/layout';
import { PlatformModule } from '@angular/cdk/platform';
import { registerLocaleData } from '@angular/common';
import { HTTP_INTERCEPTORS, HttpClientModule } from '@angular/common/http';
import de from '@angular/common/locales/de';
import { LOCALE_ID, NgModule, isDevMode } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { RouterModule } from '@angular/router';
import { ServiceWorkerModule } from '@angular/service-worker';
import { Code, ConnectError } from '@connectrpc/connect';
import {
  TkdConnectModule
} from '@tierklinik-dobersberg/angular/connect';
import { Breakpoints } from '@tierklinik-dobersberg/tailwind/breakpoints';
import { MarkdownModule } from 'ngx-markdown';
import { environment } from '../environments/environment';
import { AuthorizationInterceptor } from './api';
import { BaseURLInjector } from './api/base-url';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';

import { provideBreakpoints } from '@tierklinik-dobersberg/angular/layout';
import { HlmToasterModule } from '@tierklinik-dobersberg/angular/sonner';
import { AppHeaderComponent } from './layout';
import {
  AppNavigationComponent,
  AppSheetNavigationComponent,
} from './layout/navigation';
import { TaskDetailsComponent } from './pages/tasks/task-details/task-details';

registerLocaleData(de);

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    BrowserAnimationsModule,
    MarkdownModule.forRoot(),
    RouterModule,
    LayoutModule,
    PlatformModule,
    HlmToasterModule,
    TaskDetailsComponent,
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

    AppNavigationComponent,
    AppSheetNavigationComponent,
    AppHeaderComponent,
  ],
  providers: [
    {
      provide: HTTP_INTERCEPTORS,
      useExisting: AuthorizationInterceptor,
      multi: true,
    },
    { provide: HTTP_INTERCEPTORS, useExisting: BaseURLInjector, multi: true },
    { provide: LOCALE_ID, useValue: 'de' },
    provideBreakpoints(Breakpoints),
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
