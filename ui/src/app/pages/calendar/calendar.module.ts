import { OverlayModule } from '@angular/cdk/overlay';
import { PortalModule } from '@angular/cdk/portal';
import { NgModule } from '@angular/core';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { SharedModule } from 'src/app/shared/shared.module';
import { CalendarRoutingModule } from './calendar-routing.module';
import { DayViewComponent } from './day-view';

@NgModule({
    declarations: [
        DayViewComponent,
    ],
    exports: [
        DayViewComponent,
    ],
    imports: [
        SharedModule,
        CalendarRoutingModule,
        NzDatePickerModule,
        NzDropDownModule,
        OverlayModule,
        PortalModule,
    ],
})
export class CalendarModule { }
