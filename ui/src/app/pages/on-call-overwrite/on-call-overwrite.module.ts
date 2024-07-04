import { NgModule } from '@angular/core';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCalendarModule } from 'ng-zorro-antd/calendar';
import { NzMessageModule } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { SharedModule } from 'src/app/shared/shared.module';
import { OnCallOverwritePageComponent } from './overwrite-component';
import { OnCallOverwriteRoutingModule } from './on-call-overwrite-routing.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    NzCalendarModule,
    NzBadgeModule,
    NzAlertModule,
    NzButtonModule,
    NzIconModule,
    NzPopconfirmModule,
    NzDropDownModule,
    NzCheckboxModule,
    NzMessageModule,
    NzGridModule,
    NzInputModule,
    NzAlertModule,
    NzSelectModule,
    NzAvatarModule,
    NzToolTipModule,
    NzMessageModule,
    NzTagModule,
    NzDrawerModule,
    NzBadgeModule,
    OnCallOverwriteRoutingModule,
    SharedModule,
  ],
  declarations: [
    OnCallOverwritePageComponent,
  ],
})
export class OnCallOverwriteModule { }
