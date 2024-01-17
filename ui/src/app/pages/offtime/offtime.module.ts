import { NzMessageModule } from 'ng-zorro-antd/message';
import { NgModule } from "@angular/core";
import { SharedModule } from "src/app/shared/shared.module";
import { OfftimeRoutingModule } from "./offtime-routing.module";
import { OffTimeListComponent } from "./offtime-list/offtime-list.component";
import { OffTimeCreateComponent } from './offtime-create/offtime-create.component';
import { MarkdownModule } from 'ngx-markdown';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { FormsModule } from '@angular/forms';
import { NzCalendarModule } from 'ng-zorro-antd/calendar';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { MatchingOfftimePipe } from './matching-offtime.pipe';
import { MatchingOfftimeTooltipPipe } from './matching-offtime-tooltip.pipe';
import { LibPackerModule } from 'ng-zorro-antd/date-picker'
import { OffTimeCalendarOverviewComponent } from './offtime-calendar-overview/calendar-overview';

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
  ],
  declarations: [
    OffTimeListComponent,
    OffTimeCreateComponent,
    MatchingOfftimePipe,
    MatchingOfftimeTooltipPipe,
    OffTimeCalendarOverviewComponent
  ]
})
export class OfftimeModule {}

