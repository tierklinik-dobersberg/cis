import { LayoutModule } from '@angular/cdk/layout';
import { OverlayModule } from '@angular/cdk/overlay';
import { registerLocaleData } from '@angular/common';
import { HTTP_INTERCEPTORS, HttpClientModule } from '@angular/common/http';
import de from '@angular/common/locales/de';
import { LOCALE_ID, NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { RouterModule } from '@angular/router';
import { ServiceWorkerModule } from '@angular/service-worker';
import { FaIconLibrary, FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { far } from '@fortawesome/free-regular-svg-icons';
import { fas } from '@fortawesome/free-solid-svg-icons';
import { TKD_CIS_ENDPOINT } from '@tkd/api';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NZ_DATE_CONFIG, NZ_I18N, de_DE } from 'ng-zorro-antd/i18n';
import { NzIconService } from 'ng-zorro-antd/icon';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzMessageServiceModule } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NgChartsModule } from 'ng2-charts';
import { MarkdownModule } from 'ngx-markdown';
import { TimeagoModule } from 'ngx-timeago';
import { environment } from '../environments/environment';
import { AuthorizationInterceptor } from './api';
import { BaseURLInjector } from './api/base-url';
import { connectProviders } from './api/connect_clients';
import { ROSTERD_API } from './api/roster2';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { IconsProviderModule } from './icons-provider.module';
import { TkdOfftimeModule } from './pages/offtime';
import { SharedModule } from './shared/shared.module';

registerLocaleData(de);


@NgModule({
  declarations: [
    AppComponent,
  ],
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
    NzMessageServiceModule,
    NzBadgeModule,
    BrowserAnimationsModule,
    NzModalModule,
    TkdOfftimeModule,
    FontAwesomeModule,
    MarkdownModule.forRoot(),
    RouterModule,
    LayoutModule,
    TimeagoModule.forRoot(),
    ServiceWorkerModule.register('ngsw-worker.js', { enabled: environment.production }),
    NgChartsModule,
  ],
  providers: [
    { provide: NZ_I18N, useValue: de_DE },
    { provide: HTTP_INTERCEPTORS, useExisting: AuthorizationInterceptor, multi: true },
    { provide: HTTP_INTERCEPTORS, useExisting: BaseURLInjector, multi: true },
    { provide: NZ_DATE_CONFIG, useValue: { firstDayOfWeek: 1 } },
    { provide: LOCALE_ID, useValue: 'de'},
    { provide: ROSTERD_API, useValue: environment.rosterdURL },
    { provide: TKD_CIS_ENDPOINT, useValue: environment.baseURL },
    ...connectProviders
  ],
  bootstrap: [AppComponent]
})
export class AppModule {
  constructor(library: FaIconLibrary, iconService: NzIconService) {
    library.addIconPacks(fas, far);
  }
}
