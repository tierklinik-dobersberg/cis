import { DragDropModule } from "@angular/cdk/drag-drop";
import { OverlayModule } from "@angular/cdk/overlay";
import { NgModule } from "@angular/core";
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NzCalendarModule } from 'ng-zorro-antd/calendar';
import { TkdRosterSettingsModule } from "../admin/roster-settings";
import { SharedModule } from './../../shared/shared.module';
import { TkdConstraintViolationPipe } from "./constraint-violation-text.pipe";
import { TkdInListPipe } from "./in-list.pipe";
import { TkdRoster2DayComponent } from "./roster2-day/roster2-day.component";
import { TkdRoster2Routing } from './roster2-routing.module';
import { TkdRoster2Component } from './roster2.component';

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
    TkdRoster2Component,
    TkdRoster2DayComponent,
    TkdInListPipe,
    TkdConstraintViolationPipe
  ]
})
export class TkdRoster2Module {}
