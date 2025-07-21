import { LayoutModule } from '@angular/cdk/layout';
import { PlatformModule } from '@angular/cdk/platform';
import { registerLocaleData } from '@angular/common';
import { HTTP_INTERCEPTORS, HttpClientModule } from '@angular/common/http';
import de from '@angular/common/locales/de';
import { inject, isDevMode, LOCALE_ID, NgModule } from '@angular/core';
import { BrowserModule, HAMMER_GESTURE_CONFIG, HammerModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { Router, RouterModule } from '@angular/router';
import { ServiceWorkerModule } from '@angular/service-worker';
import { Code, ConnectError } from '@connectrpc/connect';
import {
  TkdConnectModule
} from '@tierklinik-dobersberg/angular/connect';
import { Breakpoints } from '@tierklinik-dobersberg/tailwind/breakpoints';
import markedAlert from 'marked-alert';
import { MarkdownModule, MARKED_EXTENSIONS, MARKED_OPTIONS, MarkedRenderer } from 'ngx-markdown';
import { environment } from '../environments/environment';
import { AuthorizationInterceptor } from './api';
import { BaseURLInjector } from './api/base-url';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';

import { provideBreakpoints } from '@tierklinik-dobersberg/angular/layout';
import { HlmToasterModule } from '@tierklinik-dobersberg/angular/sonner';
import { createDirectives, presetDirectiveConfigs } from 'marked-directive';
import { TaskDetailsComponent } from './features/tasks/task-details/task-details';
import { AppHeaderComponent } from './layout';
import {
  AppNavigationComponent,
  AppSheetNavigationComponent,
} from './layout/navigation';

registerLocaleData(de);

function getMarkedRenderer() {
  const r = new MarkedRenderer();

  r.link = (href, title, text) => `<a href="${href.replace('task:', '/?taskPane=')}" target="_blank">${text || title}</a>`

  return r
}

import { HammerGestureConfig } from '@angular/platform-browser';
import * as Hammer from 'hammerjs';
import { CreateEventSheetComponent } from './features/calendar2/create-event-sheet/create-event-sheet.component';
import { SearchEventsDialogComponent } from './features/calendar2/search-events-dialog/search-events-dialog.component';
import { CustomerSearchDialogComponent } from './features/customers/customer-search-dialog';
import { provideHotKeys } from './services/hot-key-manager.service';

export class MyHammerConfig extends HammerGestureConfig {
  events: string[] = [
    "swipe",
    "pan"
  ]

  overrides = <any> {
    swipe: { direction: Hammer.DIRECTION_HORIZONTAL },
    pan: {direction: Hammer.DIRECTION_HORIZONTAL, enable: true},
  };

  options = {
    inputClass: Hammer.TouchMouseInput
  }
}

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    BrowserAnimationsModule,
    MarkdownModule.forRoot({
      markedOptions: {
        provide: MARKED_OPTIONS,
        useValue: {
          gfm: true,
        }
      },
      markedExtensions: [
        markedAlert(), 
      ]
    }),
    RouterModule,
    LayoutModule,
    HammerModule,
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
    {
      provide: MARKED_EXTENSIONS,
      useValue: [
        createDirectives([
          ...presetDirectiveConfigs,
        ]),
        {
          renderer: getMarkedRenderer(),
        }
      ]
    },
    provideBreakpoints(Breakpoints),
    {
      provide: HAMMER_GESTURE_CONFIG,
      useClass: MyHammerConfig,
    },
    ...provideHotKeys([
      {
        key: 'c',
        altKey: true,
        componentType: CustomerSearchDialogComponent,
      },
      {
        key: 't',
        altKey: true,
        componentType: SearchEventsDialogComponent,
      },
      {
        key: 'n',
        altKey: true,
        componentType: CreateEventSheetComponent,
      },
      {
        key: 'k',
        altKey: true,
        onClick: () => {
          inject(Router)
            .navigate(['/calendar'])
        }
      }
    ])
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
