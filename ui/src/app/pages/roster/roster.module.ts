import { NgModule } from "@angular/core";
import { NzCalendarModule } from "ng-zorro-antd/calendar";
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NzAlertModule } from 'ng-zorro-antd/alert';

import { RosterComponent } from "./roster";
import { RosterRoutingModule } from "./roster-routing.module";

@NgModule({
  imports: [
    NzCalendarModule,
    NzBadgeModule,
    NzAlertModule,
    RosterRoutingModule,
  ],
  declarations: [
    RosterComponent,
  ],
  exports: [
    RosterComponent,
  ]
})
export class RosterModule { }
