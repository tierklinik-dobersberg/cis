import { NgModule } from "@angular/core";
import { FormsModule } from '@angular/forms';
import { HlmButtonModule } from '@tierklinik-dobersberg/angular/button';
import { NzCalendarModule } from 'ng-zorro-antd/calendar';
import { LibPackerModule } from 'ng-zorro-antd/date-picker';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzMessageModule } from 'ng-zorro-antd/message';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { MarkdownModule } from 'ngx-markdown';
import { SharedModule } from "src/app/shared/shared.module";
import { MatchingOfftimeTooltipPipe } from './matching-offtime-tooltip.pipe';
import { MatchingOfftimePipe } from './matching-offtime.pipe';
import { OffTimeCalendarOverviewComponent } from './offtime-calendar-overview/calendar-overview';
import { OffTimeListComponent } from "./offtime-list/offtime-list.component";
import { OfftimeRoutingModule } from "./offtime-routing.module";

@NgModule({
  imports: [
    SharedModule,
    OfftimeRoutingModule,
    NzMessageModule,
    NzDrawerModule,
    NzCalendarModule,
    LibPackerModule,
    NzTabsModule,
    MarkdownModule,
    FormsModule,
    HlmButtonModule,
    OffTimeCalendarOverviewComponent,
    MatchingOfftimePipe,
    MatchingOfftimeTooltipPipe,
  ],
  declarations: [
    OffTimeListComponent,
  ]
})
export class OfftimeModule {}

