import { DragDropModule } from "@angular/cdk/drag-drop";
import { OverlayModule } from "@angular/cdk/overlay";
import { NgModule } from "@angular/core";
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NzCalendarModule } from 'ng-zorro-antd/calendar';
import { TkdRosterSettingsModule } from "../admin/roster-settings";
import { SharedModule } from './../../shared/shared.module';
import { TkdConstraintViolationPipe } from "./constraint-violation-text.pipe";
import { TkdInListPipe } from "./in-list.pipe";
import { TkdRosterOverviewComponent } from "./overview";
import { TkdRosterPlannerComponent, TkdRosterPlannerDayComponent } from './planner';
import { TkdRoster2Routing } from './roster2-routing.module';

@NgModule({
  imports: [
    SharedModule,
    TkdRoster2Routing,
    NzCalendarModule,
    NzBadgeModule,
    DragDropModule,
    TkdRosterSettingsModule,
    OverlayModule
  ],
  declarations: [
    TkdRosterPlannerComponent,
    TkdRosterPlannerDayComponent,
    TkdRosterOverviewComponent,
    TkdInListPipe,
    TkdConstraintViolationPipe
  ]
})
export class TkdRoster2Module {}
