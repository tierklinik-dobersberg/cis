import { DragDropModule } from "@angular/cdk/drag-drop";
import { NgModule } from "@angular/core";
import { NzCalendarModule } from 'ng-zorro-antd/calendar';
import { SharedModule } from './../../shared/shared.module';
import { TkdRoster2DayComponent } from "./roster2-day/roster2-day.component";
import { TkdRoster2Routing } from './roster2-routing.module';
import { TkdRoster2Component } from './roster2.component';

@NgModule({
  imports: [
    SharedModule,
    TkdRoster2Routing,
    NzCalendarModule,
    DragDropModule,
  ],
  declarations: [
    TkdRoster2Component,
    TkdRoster2DayComponent
  ]
})
export class TkdRoster2Module {}
