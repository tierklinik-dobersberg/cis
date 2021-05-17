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
    imports: [
        SharedModule,
        CalendarRoutingModule,
        NzDatePickerModule,
        NzDropDownModule,
    ],
})
export class CalendarModule { }