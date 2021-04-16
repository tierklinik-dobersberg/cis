import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { SharedModule } from 'src/app/shared/shared.module';
import { CallLogComponent } from './calllog';
import { CallLogRoutingModule } from './calllog-routing.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    NzGridModule,
    NzCardModule,
    NzStatisticModule,
    NzTabsModule,
    SharedModule,
    NzDatePickerModule,
    CallLogRoutingModule,
  ],
  declarations: [
    CallLogComponent,
  ],
  exports: [
    CallLogComponent
  ]
})
export class CallLogModule { }
