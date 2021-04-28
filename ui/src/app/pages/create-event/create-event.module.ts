import { NgModule } from '@angular/core';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { SharedModule } from 'src/app/shared/shared.module';
import { CreateEventComponent } from './create-event';
import { CreateEventRoutingModule } from './create-event-routing.module';
import { QuickTimeSelectorComponent } from './quick-time-selector';

@NgModule({
    imports: [
        SharedModule,
        CreateEventRoutingModule,
        NzSelectModule,
        NzDatePickerModule,
    ],
    exports: [
        CreateEventComponent,
    ],
    declarations: [
        CreateEventComponent,
        QuickTimeSelectorComponent,
    ]
})
export class CreateEventModule { }
