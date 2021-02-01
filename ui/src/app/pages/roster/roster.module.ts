import { NgModule } from "@angular/core";
import { NzCalendarModule } from "ng-zorro-antd/calendar";
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from "ng-zorro-antd/button";
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzMessageServiceModule } from 'ng-zorro-antd/message';

import { RosterComponent } from "./roster";
import { RosterRoutingModule } from "./roster-routing.module";
import { CommonModule } from "@angular/common";
import { NzIconModule } from "ng-zorro-antd/icon";
import { NzDropDownModule } from "ng-zorro-antd/dropdown";
import { NzCheckboxModule } from "ng-zorro-antd/checkbox";
import { FormsModule } from "@angular/forms";
import { NzGridModule } from "ng-zorro-antd/grid";
import { NzSelectModule } from "ng-zorro-antd/select";
import { NzToolTipModule } from "ng-zorro-antd/tooltip";
import { NzTagModule } from 'ng-zorro-antd/tag';
import { StorageModule } from '@ngx-pwa/local-storage';

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
    NzMessageServiceModule,
    NzGridModule,
    NzAlertModule,
    NzSelectModule,
    NzToolTipModule,
    NzMessageServiceModule,
    NzTagModule,
    RosterRoutingModule,
    StorageModule,
  ],
  declarations: [
    RosterComponent,
  ],
  exports: [
    RosterComponent,
  ]
})
export class RosterModule { }
